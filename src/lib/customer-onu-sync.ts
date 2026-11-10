import { PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"
import {
  collectAndResolveMikrotikSecrets,
  formatColonMac,
  normalizeMacHex,
  type MikrotikRouterSummary,
  type ResolvedPppSecret,
} from "@/lib/mikrotik"

const ispDatabaseUrl =
  process.env.ISP_OPS_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/isp_ops_db?schema=public"

type BillingCustomerRow = {
  id: number
  id_pelanggan: string
  ip_secret: string | null
  nama_pelanggan: string | null
  alamat: string | null
  tlp: string | null
  nama_langganan: string | null
  status_langganan: string | null
}

export type CustomerOnuSyncResult = {
  ok: boolean
  syncedAt: string
  durationMs: number
  routers: MikrotikRouterSummary[]
  totalDistinctSecrets: number
  activeSecretsCount: number
  lastCallerSecretsCount: number
  totalBillingCustomers: number
  customersResolvedInMikrotik: number
  customersUpdatedInIspDb: number
  customersWithOltUpdated: number
  totalOnus: number
  validMacOnus: number
  onusLinkedTotal: number
  onusLinkedWithBillingCustomer: number
  onusLinkedMikrotikOnly: number
  offsetBreakdown: { offset: number; count: number }[]
  message: string
}

function offsetPriority(diff: number): number {
  if (diff === 0) return 0
  if (diff === 1) return 1
  if (diff === 5) return 2
  if (diff > 0 && diff <= 8) return 3 + diff
  if (diff >= -8 && diff < 0) return 15 + Math.abs(diff)
  return 30 + Math.abs(diff)
}

export async function runCustomerOnuSync(): Promise<CustomerOnuSyncResult> {
  const startedAt = Date.now()
  const ispPrisma = new PrismaClient({
    datasources: { db: { url: ispDatabaseUrl } },
  })

  try {
    const [mikrotikData, billingCustomers, dbOlts, dbOnus] = await Promise.all([
      collectAndResolveMikrotikSecrets(),
      ispPrisma.$queryRawUnsafe<BillingCustomerRow[]>(`
        SELECT id, id_pelanggan, ip_secret, nama_pelanggan, alamat, tlp, nama_langganan, status_langganan
        FROM billing_customers
        ORDER BY id ASC
      `),
      db.olt.findMany(),
      db.onu.findMany(),
    ])

    const oltById = new Map(dbOlts.map((o) => [o.id, o]))

    let activeSecretsCount = 0
    let lastCallerSecretsCount = 0
    for (const sec of mikrotikData.resolvedByExactName.values()) {
      if (sec.macSource === "active") activeSecretsCount++
      else if (sec.macSource === "last-caller") lastCallerSecretsCount++
    }

    // 1. Resolve each billing_customers row to its MikroTik secret
    type ResolvedCustomer = {
      customer: BillingCustomerRow
      secret: ResolvedPppSecret
    }

    const resolvedCustomers: ResolvedCustomer[] = []
    for (const c of billingCustomers) {
      const rawSecret = (c.ip_secret || "").trim()
      if (!rawSecret || rawSecret === "-") continue
      const resolved =
        mikrotikData.resolvedByExactName.get(rawSecret) ??
        mikrotikData.resolvedByLowerName.get(rawSecret.toLowerCase())
      if (resolved) {
        resolvedCustomers.push({ customer: c, secret: resolved })
      }
    }

    // 2. Prepare ONUs with valid 12-hex MACs
    type NormalizedOnu = (typeof dbOnus)[number] & {
      normMac: string
      macInt: bigint
      oui: string
    }

    const validOnus: NormalizedOnu[] = []
    for (const o of dbOnus) {
      const normMac = normalizeMacHex(o.serialNumber)
      if (!normMac) continue
      validOnus.push({
        ...o,
        normMac,
        macInt: BigInt("0x" + normMac),
        oui: normMac.slice(0, 6),
      })
    }

    // 3. First-pass 1-to-1 assignment: Billing Customers with MAC <-> ONUs
    type CandidateMatch = {
      rc: ResolvedCustomer
      onu: NormalizedOnu
      diff: number
      priority: number
    }

    const candidates: CandidateMatch[] = []
    for (const rc of resolvedCustomers) {
      if (!rc.secret.mac) continue
      const pppInt = BigInt("0x" + rc.secret.mac)
      const pppOui = rc.secret.mac.slice(0, 6)

      for (const onu of validOnus) {
        if (onu.oui !== pppOui) continue
        const diff = Number(pppInt - onu.macInt)
        if (Math.abs(diff) <= 16) {
          candidates.push({
            rc,
            onu,
            diff,
            priority: offsetPriority(diff),
          })
        }
      }
    }

    candidates.sort((a, b) => a.priority - b.priority)

    const assignedCustomerIds = new Set<number>()
    const assignedSecretNames = new Set<string>()
    const assignedOnuIds = new Set<string>()
    const customerIdToOltLabel = new Map<number, string>()
    const offsetCounts = new Map<number, number>()

    type LinkPayload = {
      onuId: string
      oltId: string
      idPelanggan: string | null
      namaPelanggan: string | null
      alamat: string | null
      tlp: string | null
      namaLangganan: string | null
      statusLangganan: string | null
      ipSecret: string
      routerName: string
      pppoeMac: string
      onuMac: string
      macSource: string
      macOffset: number
      lastLoggedOut: string | null
      pppoeAddress: string | null
    }

    const linksToUpsert: LinkPayload[] = []

    for (const cand of candidates) {
      if (assignedCustomerIds.has(cand.rc.customer.id) || assignedOnuIds.has(cand.onu.id)) {
        continue
      }
      assignedCustomerIds.add(cand.rc.customer.id)
      assignedSecretNames.add(cand.rc.secret.secretName.toLowerCase())
      assignedOnuIds.add(cand.onu.id)

      const olt = oltById.get(cand.onu.oltId)
      const oltName = olt?.name || cand.onu.oltId
      const oltLabel = `${oltName} (PON ${cand.onu.ponPort}:${cand.onu.onuIndex})`
      customerIdToOltLabel.set(cand.rc.customer.id, oltLabel)
      offsetCounts.set(cand.diff, (offsetCounts.get(cand.diff) || 0) + 1)

      linksToUpsert.push({
        onuId: cand.onu.id,
        oltId: cand.onu.oltId,
        idPelanggan: cand.rc.customer.id_pelanggan,
        namaPelanggan: cand.rc.customer.nama_pelanggan,
        alamat: cand.rc.customer.alamat,
        tlp: cand.rc.customer.tlp,
        namaLangganan: cand.rc.customer.nama_langganan,
        statusLangganan: cand.rc.customer.status_langganan,
        ipSecret: cand.rc.secret.secretName,
        routerName: cand.rc.secret.routerName,
        pppoeMac: cand.rc.secret.rawMac,
        onuMac: formatColonMac(cand.onu.normMac),
        macSource: cand.rc.secret.macSource,
        macOffset: cand.diff,
        lastLoggedOut: cand.rc.secret.lastLoggedOut ?? null,
        pppoeAddress: cand.rc.secret.address ?? null,
      })
    }

    const onusLinkedWithBillingCustomer = linksToUpsert.length

    // 4. Second-pass 1-to-1 assignment: Remaining ONUs <-> Remaining MikroTik secrets (not in billing_customers)
    type SecretOnlyCandidate = {
      secret: ResolvedPppSecret
      onu: NormalizedOnu
      diff: number
      priority: number
    }

    const secretOnlyCandidates: SecretOnlyCandidate[] = []
    for (const secret of mikrotikData.resolvedByExactName.values()) {
      if (!secret.mac || assignedSecretNames.has(secret.secretName.toLowerCase())) continue
      const pppInt = BigInt("0x" + secret.mac)
      const pppOui = secret.mac.slice(0, 6)

      for (const onu of validOnus) {
        if (assignedOnuIds.has(onu.id) || onu.oui !== pppOui) continue
        const diff = Number(pppInt - onu.macInt)
        if (Math.abs(diff) <= 16) {
          secretOnlyCandidates.push({
            secret,
            onu,
            diff,
            priority: offsetPriority(diff),
          })
        }
      }
    }

    secretOnlyCandidates.sort((a, b) => a.priority - b.priority)

    for (const cand of secretOnlyCandidates) {
      const lowerSec = cand.secret.secretName.toLowerCase()
      if (assignedSecretNames.has(lowerSec) || assignedOnuIds.has(cand.onu.id)) continue
      assignedSecretNames.add(lowerSec)
      assignedOnuIds.add(cand.onu.id)
      offsetCounts.set(cand.diff, (offsetCounts.get(cand.diff) || 0) + 1)

      linksToUpsert.push({
        onuId: cand.onu.id,
        oltId: cand.onu.oltId,
        idPelanggan: null,
        namaPelanggan: null,
        alamat: null,
        tlp: null,
        namaLangganan: cand.secret.profile ?? null,
        statusLangganan: null,
        ipSecret: cand.secret.secretName,
        routerName: cand.secret.routerName,
        pppoeMac: cand.secret.rawMac,
        onuMac: formatColonMac(cand.onu.normMac),
        macSource: cand.secret.macSource,
        macOffset: cand.diff,
        lastLoggedOut: cand.secret.lastLoggedOut ?? null,
        pppoeAddress: cand.secret.address ?? null,
      })
    }

    const onusLinkedMikrotikOnly = linksToUpsert.length - onusLinkedWithBillingCustomer

    // 5. Persist to olt_db.onu_customer_links in batches
    const linkedOnuIds = linksToUpsert.map((l) => l.onuId)
    await db.onuCustomerLink.deleteMany({
      where: { onuId: { notIn: linkedOnuIds } },
    })

    const batchSize = 200
    for (let i = 0; i < linksToUpsert.length; i += batchSize) {
      const batch = linksToUpsert.slice(i, i + batchSize)
      await db.$transaction(
        batch.map((item) =>
          db.onuCustomerLink.upsert({
            where: { onuId: item.onuId },
            update: {
              oltId: item.oltId,
              idPelanggan: item.idPelanggan,
              namaPelanggan: item.namaPelanggan,
              alamat: item.alamat,
              tlp: item.tlp,
              namaLangganan: item.namaLangganan,
              statusLangganan: item.statusLangganan,
              ipSecret: item.ipSecret,
              routerName: item.routerName,
              pppoeMac: item.pppoeMac,
              onuMac: item.onuMac,
              macSource: item.macSource,
              macOffset: item.macOffset,
              lastLoggedOut: item.lastLoggedOut,
              pppoeAddress: item.pppoeAddress,
            },
            create: item,
          })
        )
      )
    }

    // 6. Update isp_ops_db.billing_customers (nama_router for all resolved customers, id_olt for ONU-matched customers)
    const ispUpdates = resolvedCustomers.map((rc) => ({
      id: rc.customer.id,
      namaRouter: rc.secret.routerName,
      idOlt: customerIdToOltLabel.get(rc.customer.id) ?? null,
    }))

    const ispBatchSize = 400
    for (let i = 0; i < ispUpdates.length; i += ispBatchSize) {
      const batch = ispUpdates.slice(i, i + ispBatchSize)
      const params: (number | string | null)[] = []
      const valueTuples: string[] = []
      batch.forEach((row, idx) => {
        const base = idx * 3
        valueTuples.push(`($${base + 1}::int, $${base + 2}::varchar, $${base + 3}::varchar)`)
        params.push(row.id, row.namaRouter, row.idOlt)
      })

      await ispPrisma.$executeRawUnsafe(
        `UPDATE billing_customers AS bc
         SET nama_router = v.nama_router,
             id_olt = v.id_olt
         FROM (VALUES ${valueTuples.join(", ")}) AS v(id, nama_router, id_olt)
         WHERE bc.id = v.id`,
        ...params
      )
    }

    const offsetBreakdown = [...offsetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([offset, count]) => ({ offset, count }))

    const durationMs = Date.now() - startedAt
    const message = `Sync selesai (${(durationMs / 1000).toFixed(1)}s): ${linksToUpsert.length}/${validOnus.length} ONU terhubung (${onusLinkedWithBillingCustomer} pelanggan billing + ${onusLinkedMikrotikOnly} PPPoE), ${ispUpdates.length} pelanggan diupdate nama_router di isp_ops_db.`

    return {
      ok: true,
      syncedAt: new Date().toISOString(),
      durationMs,
      routers: mikrotikData.routers,
      totalDistinctSecrets: mikrotikData.resolvedByExactName.size,
      activeSecretsCount,
      lastCallerSecretsCount,
      totalBillingCustomers: billingCustomers.length,
      customersResolvedInMikrotik: resolvedCustomers.length,
      customersUpdatedInIspDb: ispUpdates.length,
      customersWithOltUpdated: customerIdToOltLabel.size,
      totalOnus: dbOnus.length,
      validMacOnus: validOnus.length,
      onusLinkedTotal: linksToUpsert.length,
      onusLinkedWithBillingCustomer,
      onusLinkedMikrotikOnly,
      offsetBreakdown,
      message,
    }
  } finally {
    await ispPrisma.$disconnect()
  }
}
