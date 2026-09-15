import type { Olt, Onu, RenameOnuRequest, RenameOnuResult } from "@/lib/types"
import { getOidProfile } from "@/lib/oid-catalog"

export const baseSystemOids = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysObjectId: "1.3.6.1.2.1.1.2.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",
}

type SnmpTestTarget = Pick<Olt, "ipAddress" | "snmpPort" | "snmpVersion" | "readCommunity" | "oidProfile">
type SnmpWriteTarget = Pick<Olt, "ipAddress" | "snmpPort" | "snmpVersion" | "readCommunity" | "writeCommunity" | "oidProfile">

type SnmpSession = ReturnType<typeof import("net-snmp").createSession>

type SnmpRow = {
  oid: string
  value: string
}

type PartialOnu = {
  ontIndex: string
  name?: string
  serial?: string
  model?: string
  runState?: string
  rxPower?: number | null
  txPower?: number | null
  temperature?: number | null
  lastDownReason?: string
}

const hsgqGponOids = {
  ontInfoBase: "1.3.6.1.4.1.50224.3.12.2.1",
  ontName: "1.3.6.1.4.1.50224.3.12.2.1.2",
  runState: "1.3.6.1.4.1.50224.3.12.2.1.4",
  serial: "1.3.6.1.4.1.50224.3.12.2.1.15",
  lastDownReason: "1.3.6.1.4.1.50224.3.12.2.1.22",
  opticalBase: "1.3.6.1.4.1.50224.3.12.3.1",
  rxPower: "1.3.6.1.4.1.50224.3.12.3.1.4",
  txPower: "1.3.6.1.4.1.50224.3.12.3.1.5",
  temperature: "1.3.6.1.4.1.50224.3.12.3.1.8",
}

const hsgqEponOids = {
  ontInfoBase: "1.3.6.1.4.1.50224.3.3.2.1",
  ontName: "1.3.6.1.4.1.50224.3.3.2.1.2",
  runState: "1.3.6.1.4.1.50224.3.3.2.1.8",
  serial: "1.3.6.1.4.1.50224.3.3.2.1.7",
  lastDownReason: "1.3.6.1.4.1.50224.3.3.2.1.31",
  opticalBase: "1.3.6.1.4.1.50224.3.3.3.1",
  rxPower: "1.3.6.1.4.1.50224.3.3.3.1.4",
  txPower: "",
  temperature: "1.3.6.1.4.1.50224.3.3.3.1.8",
}

const vsolGponOids = {
  productType: "1.3.6.1.4.1.37950.1.1.5.10.14.6.0",
  statusCode: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.5",
  lastDownReason: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.10",
  serial: "1.3.6.1.4.1.37950.1.1.6.1.1.2.1.5",
  model: "1.3.6.1.4.1.37950.1.1.6.1.1.2.1.6",
  temperature: "1.3.6.1.4.1.37950.1.1.6.1.1.3.1.3",
  rxPower: "1.3.6.1.4.1.37950.1.1.6.1.1.3.1.7",
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  ifAlias: "1.3.6.1.2.1.31.1.1.1.18",
}

function valueToText(value: unknown) {
  if (Buffer.isBuffer(value)) {
    const text = value.toString("utf8").replace(/\0/g, "").trim()
    return /^[\x20-\x7E\r\n\t]*$/.test(text) ? text : value.toString("hex").toUpperCase()
  }

  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function oidCompare(a: string, b: string) {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? -1
    const rightValue = right[index] ?? -1
    if (leftValue !== rightValue) return leftValue - rightValue
  }

  return 0
}

function isInSubtree(oid: string, rootOid: string) {
  return oid === rootOid || oid.startsWith(`${rootOid}.`)
}

function toNumber(value: string | undefined) {
  if (!value || value === "NULL" || value === "N/A") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function opticalScale(value: string | undefined) {
  const number = toNumber(value)
  if (number === null || number === -2147483648) return null
  return number / 100
}

function decodeHsgqOntIndex(index: string) {
  const raw = Number(index)
  if (!Number.isFinite(raw)) {
    return { ponPort: "-", ontId: "-", ponOnt: "-" }
  }

  const base = raw - 16777216
  const ponPort = Math.floor(base / 256)
  const ontId = raw % 256

  return {
    ponPort: String(ponPort),
    ontId: String(ontId),
    ponOnt: `${ponPort}/${ontId}`,
  }
}

function statusFromRunState(runState: string | undefined): Onu["status"] {
  if (String(runState) === "1") return "online"
  return "offline"
}

function statusFromVsolCode(statusCode: string | undefined): Onu["status"] {
  if (String(statusCode) === "3") return "online"
  return "offline"
}

function normalizeDownReason(value: string | undefined) {
  const text = String(value || "").trim()
  if (!text || text === "0") return null

  const numericReasons: Record<string, string> = {
    "1": "LOS",
    "2": "LOSi",
    "3": "LOFi",
    "4": "Dying gasp",
    "5": "LOAMi",
    "6": "Deactive",
    "7": "Reset",
    "8": "Re-register",
    "9": "Power off",
  }

  return numericReasons[text] || text
}

function createSnmpSession(snmp: typeof import("net-snmp"), olt: SnmpTestTarget) {
  const version = olt.snmpVersion === "v1" ? snmp.Version1 : snmp.Version2c

  return snmp.createSession(olt.ipAddress, olt.readCommunity, {
    version,
    port: olt.snmpPort || 161,
    timeout: 8000,
    retries: 1,
  })
}

function createSnmpWriteSession(snmp: typeof import("net-snmp"), olt: SnmpWriteTarget) {
  const version = olt.snmpVersion === "v1" ? snmp.Version1 : snmp.Version2c
  const community = olt.writeCommunity?.trim()

  if (!community) {
    throw new Error("Write Community belum diisi.")
  }

  return snmp.createSession(olt.ipAddress, community, {
    version,
    port: olt.snmpPort || 161,
    timeout: 8000,
    retries: 1,
  })
}

function hsgqOntIndexFromOnu(olt: Olt, onu: Onu) {
  const idPrefix = `${olt.id}-`
  if (onu.id.startsWith(idPrefix)) return onu.id.slice(idPrefix.length)

  const ponPort = Number(onu.ponPort)
  const onuIndex = Number(onu.onuIndex)
  if (!Number.isFinite(ponPort) || !Number.isFinite(onuIndex)) return null

  return String(16777216 + ponPort * 256 + onuIndex)
}

function decodeVsolOntIndex(index: string) {
  const [ponPort, ontId] = String(index || "").split(".")

  return {
    ponPort: ponPort || "-",
    ontId: ontId || "-",
    ponOnt: ponPort && ontId ? `${ponPort}/${ontId}` : "-",
  }
}

function getVsolPonCount(productType: string | undefined) {
  const match = String(productType || "").match(/OLT-(\d+)G/i)
  const ponCount = match ? Number(match[1]) : 4

  return Number.isFinite(ponCount) && ponCount > 0 ? ponCount : 4
}

function parseVsolIfDescr(value: string | undefined) {
  const match = String(value || "")
    .trim()
    .match(/^GPON0?(\d+)ONU(\d+)\s*(.*)$/i)

  if (!match) return null

  const pon = Number(match[1])
  const ont = Number(match[2])
  const name = String(match[3] || "").trim()

  if (!pon || !ont) return null

  return {
    ontIndex: `${pon}.${ont}`,
    name,
  }
}

function parseVsolIfDescrName(value: string | undefined) {
  const parsed = parseVsolIfDescr(value)
  if (!parsed?.name) return null
  return parsed
}

function vsolInterfaceIndexFromOnu(onu: Onu) {
  const ponPort = Number(onu.ponPort)
  const onuIndex = Number(onu.onuIndex)

  if (!Number.isFinite(ponPort) || !Number.isFinite(onuIndex) || ponPort < 1 || onuIndex < 1) return null

  if (ponPort === 1) return String(onuIndex + 9)
  if (ponPort === 2) return String(onuIndex + 81)
  if (ponPort === 3) return String(onuIndex + 144)
  if (ponPort === 4) return String(onuIndex + 145)

  return null
}

function isDefaultVsolAlias(value: string | undefined) {
  return /^GPON0\/\d+:\d+$/i.test(String(value || "").trim())
}

function findVsolIfDescrTarget(rows: SnmpRow[], onu?: Onu) {
  if (onu) {
    const ontIndex = `${onu.ponPort}.${onu.onuIndex}`
    const found = rows.find((row) => parseVsolIfDescr(row.value)?.ontIndex === ontIndex)
    if (found) return found
  }

  return rows.find((row) => parseVsolIfDescr(row.value))
}

function findVsolAliasTarget(rows: SnmpRow[], onu?: Onu) {
  if (onu) {
    const interfaceIndex = vsolInterfaceIndexFromOnu(onu)
    const foundByOid = interfaceIndex ? rows.find((row) => row.oid === `${vsolGponOids.ifAlias}.${interfaceIndex}`) : undefined
    if (foundByOid) return foundByOid
  }

  return rows.find((row) => row.value && !isDefaultVsolAlias(row.value)) ?? rows.find((row) => row.value)
}

function vsolInterfaceIndexFromOid(oid: string, baseOid: string) {
  return oid.startsWith(`${baseOid}.`) ? oid.replace(`${baseOid}.`, "") : null
}

function mapVsolInterfaceIndexes(ifDescrRows: SnmpRow[]) {
  const indexes = new Map<string, string>()

  for (const row of ifDescrRows) {
    const parsed = parseVsolIfDescr(row.value)
    const interfaceIndex = vsolInterfaceIndexFromOid(row.oid, vsolGponOids.ifDescr)

    if (parsed?.ontIndex && interfaceIndex) {
      indexes.set(parsed.ontIndex, interfaceIndex)
    }
  }

  return indexes
}

async function walk(snmp: typeof import("net-snmp"), session: SnmpSession, rootOid: string, maxRows = 12000) {
  const rows: SnmpRow[] = []
  let cursor = rootOid

  while (rows.length < maxRows) {
    const varbinds = await new Promise<Array<Array<{ oid: string; value: unknown }> | { oid: string; value: unknown }>>((resolve, reject) => {
      session.getBulk([cursor], 0, 25, (error, result) => {
        if (error) {
          reject(error)
          return
        }
        resolve(result)
      })
    })
    const list = Array.isArray(varbinds[0]) ? (varbinds[0] as Array<{ oid: string; value: unknown }>) : (varbinds as Array<{ oid: string; value: unknown }>)
    let moved = false

    for (const varbind of list) {
      if (!varbind?.oid || !isInSubtree(varbind.oid, rootOid)) return rows
      if (oidCompare(varbind.oid, cursor) <= 0) continue
      if (!snmp.isVarbindError(varbind)) {
        rows.push({ oid: varbind.oid, value: valueToText(varbind.value) })
      }
      cursor = varbind.oid
      moved = true
      if (rows.length >= maxRows) return rows
    }

    if (!moved) return rows
  }

  return rows
}

async function getRows(snmp: typeof import("net-snmp"), session: SnmpSession, oids: string[]) {
  if (oids.length === 0) return [] as SnmpRow[]

  return new Promise<SnmpRow[] | null>((resolve) => {
    session.get(oids, (error: Error | null, varbinds: Array<{ oid: string; value: unknown }>) => {
      if (error) {
        resolve(null)
        return
      }

      const rows: SnmpRow[] = []
      for (const varbind of varbinds) {
        if (!snmp.isVarbindError(varbind)) {
          rows.push({ oid: varbind.oid, value: valueToText(varbind.value) })
        }
      }
      resolve(rows)
    })
  })
}

async function getRowsWithFallback(snmp: typeof import("net-snmp"), session: SnmpSession, oids: string[]): Promise<SnmpRow[]> {
  const rows = await getRows(snmp, session, oids)
  if (rows !== null) return rows
  if (oids.length <= 1) return []

  const middle = Math.ceil(oids.length / 2)
  const [left, right] = await Promise.all([
    getRowsWithFallback(snmp, session, oids.slice(0, middle)),
    getRowsWithFallback(snmp, session, oids.slice(middle)),
  ])

  return [...left, ...right]
}

async function getColumnForIndexes(snmp: typeof import("net-snmp"), session: SnmpSession, baseOid: string, indexes: string[], chunkSize = 24) {
  const rows: SnmpRow[] = []

  for (let index = 0; index < indexes.length; index += chunkSize) {
    const chunk = indexes.slice(index, index + chunkSize).map((item) => `${baseOid}.${item}`)
    const chunkRows = await getRowsWithFallback(snmp, session, chunk)
    rows.push(...chunkRows)
  }

  return rows
}

function assignByColumn(target: Map<string, PartialOnu>, rows: SnmpRow[], baseOid: string, key: keyof PartialOnu, transform: (value: string) => PartialOnu[keyof PartialOnu] = (value) => value) {
  rows
    .filter((row) => row.oid.startsWith(`${baseOid}.`))
    .forEach((row) => {
      const index = row.oid.replace(`${baseOid}.`, "")
      if (!target.has(index)) target.set(index, { ontIndex: index })
      const item = target.get(index)
      if (item) {
        Object.assign(item, { [key]: transform(row.value) })
      }
    })
}

function assignVsolNames(target: Map<string, PartialOnu>, rows: SnmpRow[]) {
  rows.forEach((row) => {
    const parsed = parseVsolIfDescrName(row.value)
    if (!parsed) return

    if (!target.has(parsed.ontIndex)) target.set(parsed.ontIndex, { ontIndex: parsed.ontIndex })
    const item = target.get(parsed.ontIndex)
    if (item) {
      item.name = parsed.name
    }
  })
}

function assignVsolAliasNames(target: Map<string, PartialOnu>, rows: SnmpRow[], interfaceIndexByOntIndex: Map<string, string>) {
  rows.forEach((row) => {
    const interfaceIndex = vsolInterfaceIndexFromOid(row.oid, vsolGponOids.ifAlias)
    const value = String(row.value || "").trim()

    if (!interfaceIndex || !value || isDefaultVsolAlias(value)) return

    for (const [ontIndex, mappedInterfaceIndex] of interfaceIndexByOntIndex.entries()) {
      if (mappedInterfaceIndex !== interfaceIndex) continue
      if (!target.has(ontIndex)) target.set(ontIndex, { ontIndex })
      const item = target.get(ontIndex)
      if (item) item.name = value
      return
    }
  })
}

function assignOpticalColumn(target: Map<string, PartialOnu>, rows: SnmpRow[], baseOid: string, key: keyof PartialOnu) {
  if (!baseOid) return

  rows
    .filter((row) => row.oid.startsWith(`${baseOid}.`))
    .forEach((row) => {
      const rawIndex = row.oid.replace(`${baseOid}.`, "")
      const parts = rawIndex.split(".")
      const index = parts[0]
      const suffix = parts.slice(1).join(".")
      const isMainReading = suffix === "" || suffix === "0.0"

      if (!target.has(index)) target.set(index, { ontIndex: index })
      const item = target.get(index)
      if (item && (isMainReading || item[key] === undefined || item[key] === null)) {
        Object.assign(item, { [key]: opticalScale(row.value) })
      }
    })
}

function mapVsolOnus(olt: Olt, items: PartialOnu[]): Onu[] {
  return items
    .filter((item) => item.serial || item.model || item.rxPower !== undefined || item.runState)
    .map((item) => {
      const decoded = decodeVsolOntIndex(item.ontIndex)
      const status = statusFromVsolCode(item.runState)
      const fallbackName = item.serial ? `ONU-${item.serial}` : `ONU-${decoded.ponOnt}`

      return {
        id: `${olt.id}-${item.ontIndex}`,
        oltId: olt.id,
        name: item.name || fallbackName,
        serialNumber: item.serial || "-",
        ponPort: decoded.ponPort,
        onuIndex: decoded.ontId,
        status,
        rxPower: item.rxPower ?? 0,
        txPower: item.txPower ?? 0,
        temperatureC: item.temperature ?? null,
        downReason: normalizeDownReason(item.lastDownReason),
        distanceMeters: 0,
        lastSeen: "Baru saja",
        syncStatus: "synced" as const,
      }
    })
    .sort((a, b) => {
      const aPon = Number(a.ponPort)
      const bPon = Number(b.ponPort)
      if (aPon !== bPon) return aPon - bPon
      return Number(a.onuIndex) - Number(b.onuIndex)
    })
}

function mapHsgqOnus(olt: Olt, items: PartialOnu[]): Onu[] {
  return items
    .filter((item) => item.name || item.serial || item.runState || item.rxPower !== undefined)
    .map((item) => {
      const decoded = decodeHsgqOntIndex(item.ontIndex)
      const status = statusFromRunState(item.runState)
      const fallbackName = item.serial ? `ONU-${item.serial}` : `ONU-${decoded.ponOnt}`

      return {
        id: `${olt.id}-${item.ontIndex}`,
        oltId: olt.id,
        name: item.name || fallbackName,
        serialNumber: item.serial || "-",
        ponPort: decoded.ponPort,
        onuIndex: decoded.ontId,
        status,
        rxPower: item.rxPower ?? 0,
        txPower: item.txPower ?? 0,
        temperatureC: item.temperature ?? null,
        downReason: normalizeDownReason(item.lastDownReason),
        distanceMeters: 0,
        lastSeen: "Baru saja",
        syncStatus: "synced" as const,
      }
    })
    .sort((a, b) => {
      const aPon = Number(a.ponPort)
      const bPon = Number(b.ponPort)
      if (aPon !== bPon) return aPon - bPon
      return Number(a.onuIndex) - Number(b.onuIndex)
    })
}

async function pollVsolOnusFromOlt(snmp: typeof import("net-snmp"), session: SnmpSession, olt: Olt) {
  const systemRows = await getRowsWithFallback(snmp, session, [baseSystemOids.sysDescr, baseSystemOids.sysObjectId, baseSystemOids.sysUpTime, baseSystemOids.sysName, vsolGponOids.productType])
  const systemValues = Object.fromEntries(systemRows.map((row) => [row.oid, row.value]))
  const ponCount = getVsolPonCount(systemValues[vsolGponOids.productType])
  const generatedIndexes: string[] = []

  for (let pon = 1; pon <= ponCount; pon += 1) {
    for (let onu = 1; onu <= 128; onu += 1) {
      generatedIndexes.push(`${pon}.${onu}`)
    }
  }

  const onusByIndex = new Map<string, PartialOnu>()
  const statusRows = await getColumnForIndexes(snmp, session, vsolGponOids.statusCode, generatedIndexes, 24)

  assignByColumn(onusByIndex, statusRows, vsolGponOids.statusCode, "runState")

  const indexes = [...onusByIndex.keys()].sort((a, b) => {
    const left = decodeVsolOntIndex(a)
    const right = decodeVsolOntIndex(b)
    const leftPon = Number(left.ponPort)
    const rightPon = Number(right.ponPort)

    if (leftPon !== rightPon) return leftPon - rightPon
    return Number(left.ontId) - Number(right.ontId)
  })

  const [serialRows, modelRows, lastDownReasonRows, temperatureRows, rxPowerRows, ifDescrRows, ifAliasRows] = await Promise.all([
    getColumnForIndexes(snmp, session, vsolGponOids.serial, indexes, 24),
    getColumnForIndexes(snmp, session, vsolGponOids.model, indexes, 24),
    getColumnForIndexes(snmp, session, vsolGponOids.lastDownReason, indexes, 24),
    getColumnForIndexes(snmp, session, vsolGponOids.temperature, indexes, 12),
    getColumnForIndexes(snmp, session, vsolGponOids.rxPower, indexes, 12),
    walk(snmp, session, vsolGponOids.ifDescr, 320),
    walk(snmp, session, vsolGponOids.ifAlias, 320),
  ])

  assignByColumn(onusByIndex, serialRows, vsolGponOids.serial, "serial")
  assignByColumn(onusByIndex, modelRows, vsolGponOids.model, "model")
  assignByColumn(onusByIndex, lastDownReasonRows, vsolGponOids.lastDownReason, "lastDownReason")
  assignByColumn(onusByIndex, temperatureRows, vsolGponOids.temperature, "temperature", toNumber)
  assignByColumn(onusByIndex, rxPowerRows, vsolGponOids.rxPower, "rxPower", toNumber)
  const interfaceIndexByOntIndex = mapVsolInterfaceIndexes(ifDescrRows)
  assignVsolNames(onusByIndex, ifDescrRows)
  assignVsolAliasNames(onusByIndex, ifAliasRows, interfaceIndexByOntIndex)

  return mapVsolOnus(olt, [...onusByIndex.values()])
}

export async function testSnmpConnection(olt: SnmpTestTarget) {
  if (!olt.ipAddress || !olt.readCommunity) {
    return {
      ok: false,
      message: "IP dan community SNMP wajib diisi.",
    }
  }

  const snmp = await import("net-snmp")
  const profile = getOidProfile(olt.oidProfile)
  const systemOids = profile.items.filter((item) => item.kind === "system").map((item) => item.oid)
  const session = createSnmpSession(snmp, olt)

  try {
    const values = await new Promise<Record<string, string>>((resolve, reject) => {
      session.get(systemOids, (error: Error | null, varbinds: Array<{ oid: string; value: unknown }>) => {
        if (error) {
          reject(error)
          return
        }

        const result: Record<string, string> = {}
        for (const varbind of varbinds) {
          result[varbind.oid] = valueToText(varbind.value)
        }
        resolve(result)
      })
    })

    return {
      ok: true,
      message: `SNMP berhasil ke ${olt.ipAddress}:${olt.snmpPort || 161}. Profil OID: ${profile.name}.`,
      values,
      oids: profile.items,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "SNMP test gagal.",
      oids: profile.items,
    }
  } finally {
    session.close()
  }
}

export async function pollOnusFromOlt(olt: Olt) {
  if (!olt.ipAddress || !olt.readCommunity) {
    return {
      ok: false,
      message: "IP dan community SNMP wajib diisi.",
      onus: [] as Onu[],
    }
  }

  if (olt.oidProfile !== "hsgq-gpon" && olt.oidProfile !== "hsgq-epon" && olt.oidProfile !== "vsol-gpon") {
    return {
      ok: false,
      message: `Polling ONU untuk profile ${olt.oidProfile} belum aktif. Saat ini yang aktif: VSOL GPON, HSGQ GPON/EPON.`,
      onus: [] as Onu[],
    }
  }

  const snmp = await import("net-snmp")
  const session = createSnmpSession(snmp, olt)

  try {
    if (olt.oidProfile === "vsol-gpon") {
      const onus = await pollVsolOnusFromOlt(snmp, session, olt)

      return {
        ok: true,
        message: `Polling ONU selesai. Ditemukan ${onus.length} ONU/ONT dari ${olt.name}.`,
        onus,
      }
    }

    const oids = olt.oidProfile === "hsgq-epon" ? hsgqEponOids : hsgqGponOids
    const [ontInfoRows, opticalRows] = await Promise.all([walk(snmp, session, oids.ontInfoBase), walk(snmp, session, oids.opticalBase)])
    const onusByIndex = new Map<string, PartialOnu>()

    assignByColumn(onusByIndex, ontInfoRows, oids.ontName, "name")
    assignByColumn(onusByIndex, ontInfoRows, oids.runState, "runState")
    assignByColumn(onusByIndex, ontInfoRows, oids.serial, "serial")
    assignByColumn(onusByIndex, ontInfoRows, oids.lastDownReason, "lastDownReason")
    assignOpticalColumn(onusByIndex, opticalRows, oids.rxPower, "rxPower")
    assignOpticalColumn(onusByIndex, opticalRows, oids.txPower, "txPower")
    assignOpticalColumn(onusByIndex, opticalRows, oids.temperature, "temperature")

    const onus = mapHsgqOnus(olt, [...onusByIndex.values()])

    return {
      ok: true,
      message: `Polling ONU selesai. Ditemukan ${onus.length} ONU/ONT dari ${olt.name}.`,
      onus,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Polling ONU gagal.",
      onus: [] as Onu[],
    }
  } finally {
    session.close()
  }
}

export async function testOnuRenameWrite(olt: Olt) {
  if (!olt.writeCommunity?.trim()) {
    return {
      ok: false,
      message: "Write Community belum diisi. Test write dan fitur rename masih nonaktif.",
    }
  }

  if (olt.writeMode !== "snmp") {
    return {
      ok: false,
      message: "Mode rename ONU harus SNMP untuk menjalankan Test Write.",
    }
  }

  if (olt.oidProfile === "hsgq-epon") {
    return {
      ok: false,
      message: "HSGQ EPON belum mendukung rename via SNMP. OID nama ONU EPON bisa dibaca, tetapi OLT menolak saat ditulis.",
    }
  }

  if (olt.oidProfile !== "hsgq-gpon" && olt.oidProfile !== "vsol-gpon") {
    return {
      ok: false,
      message: `Test Write untuk profile ${olt.oidProfile} belum tersedia. Saat ini yang aktif: VSOL GPON dan HSGQ GPON.`,
    }
  }

  const snmp = await import("net-snmp")
  const isVsol = olt.oidProfile === "vsol-gpon"
  const readSession = createSnmpSession(snmp, olt)

  try {
    const rows = isVsol ? await walk(snmp, readSession, vsolGponOids.ifAlias, 320) : await walk(snmp, readSession, hsgqGponOids.ontName, 1)
    const target = isVsol ? findVsolAliasTarget(rows) : rows[0]

    if (!target?.oid || !target.value) {
      return {
        ok: false,
        message: isVsol
          ? "Test Write belum bisa dilakukan karena belum ada alias ONU VSOL yang terbaca dari OLT."
          : "Test Write belum bisa dilakukan karena belum ada nama ONU/ONT yang terbaca dari OLT.",
      }
    }

    const writeSession = createSnmpWriteSession(snmp, olt)

    try {
      await new Promise<void>((resolve, reject) => {
        sessionSet(writeSession, snmp.ObjectType.OctetString, target.oid, target.value, (error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })

      return {
        ok: true,
        message: isVsol
          ? "Write Community valid untuk alias VSOL. Nama dari aplikasi akan dijaga saat polling ulang karena nama utama VSOL masih dibaca dari ifDescr."
          : "Write Community valid. Rename ONU/ONT siap digunakan.",
      }
    } finally {
      writeSession.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""

    if (isVsol && message.includes("NotWritable")) {
      return {
        ok: false,
        message:
          "Test Write menjangkau OLT VSOL, tetapi OID alias ONU/ONT masih ditolak (NotWritable). Pastikan SNMP Read-Write aktif dan Write Community benar.",
      }
    }

    return {
      ok: false,
      message: error instanceof Error ? `Test Write gagal: ${error.message}` : "Test Write gagal.",
    }
  } finally {
    readSession.close()
  }
}

function sessionSet(
  session: SnmpSession,
  type: number,
  oid: string,
  value: string,
  callback: (error: Error | null) => void,
) {
  session.set([{ oid, type, value }], (error) => callback(error))
}

export async function renameOnuOnDevice({ olt, onu, nextName }: RenameOnuRequest): Promise<RenameOnuResult> {
  const cleanName = nextName.trim()

  if (!cleanName) {
    return {
      ok: false,
      syncedToDevice: false,
      message: "Nama ONU/ONT tidak boleh kosong.",
    }
  }

  if (cleanName.length > 64) {
    return {
      ok: false,
      syncedToDevice: false,
      message: "Nama ONU/ONT maksimal 64 karakter agar aman dikirim ke OLT.",
    }
  }

  if (olt.writeMode === "none") {
    return {
      ok: true,
      syncedToDevice: false,
      message: "Nama tersimpan di aplikasi. OLT ini belum punya metode write yang aktif.",
    }
  }

  if (olt.writeMode === "snmp") {
    if (olt.oidProfile === "hsgq-epon") {
      return {
        ok: false,
        syncedToDevice: false,
        message: "HSGQ EPON belum mendukung rename via SNMP. OID nama ONU EPON bisa dibaca, tetapi OLT menolak saat ditulis.",
      }
    }

    if (olt.oidProfile !== "hsgq-gpon" && olt.oidProfile !== "vsol-gpon") {
      return {
        ok: false,
        syncedToDevice: false,
        message: `SNMP rename untuk profile ${olt.oidProfile} belum tersedia. Saat ini yang aktif: VSOL GPON dan HSGQ GPON.`,
      }
    }

    if (olt.oidProfile === "vsol-gpon") {
      const snmp = await import("net-snmp")
      const readSession = createSnmpSession(snmp, olt)

      try {
        const ifDescrRows = await walk(snmp, readSession, vsolGponOids.ifDescr, 320)
        const ifDescrTarget = findVsolIfDescrTarget(ifDescrRows, onu)
        const dynamicInterfaceIndex = ifDescrTarget ? vsolInterfaceIndexFromOid(ifDescrTarget.oid, vsolGponOids.ifDescr) : null
        const fallbackInterfaceIndex = vsolInterfaceIndexFromOnu(onu)
        const targetIndex = dynamicInterfaceIndex || fallbackInterfaceIndex

        if (!targetIndex) {
          return {
            ok: false,
            syncedToDevice: false,
            message: "Index ONU/ONT VSOL tidak valid, rename ke OLT dibatalkan.",
          }
        }

        const targetOid = `${vsolGponOids.ifAlias}.${targetIndex}`
        const session = createSnmpWriteSession(snmp, olt)

        try {
          await new Promise<void>((resolve, reject) => {
            sessionSet(session, snmp.ObjectType.OctetString, targetOid, cleanName, (error) => {
              if (error) {
                reject(error)
                return
              }
              resolve()
            })
          })

          return {
            ok: true,
            syncedToDevice: false,
            message:
              `Nama ${onu.serialNumber} disimpan di aplikasi. OLT VSOL menerima write ke alias, tetapi nama utama ONU masih dibaca dari ifDescr yang read-only, jadi aplikasi akan menjaga nama ini saat polling ulang.`,
          }
        } finally {
          session.close()
        }
      } catch (error) {
        return {
          ok: false,
          syncedToDevice: false,
          message: error instanceof Error ? `Rename ke OLT VSOL gagal: ${error.message}` : "Rename ke OLT VSOL gagal.",
        }
      } finally {
        readSession.close()
      }
    }

    const deviceIndex = hsgqOntIndexFromOnu(olt, onu)
    if (!deviceIndex) {
      return {
        ok: false,
        syncedToDevice: false,
        message: "Index ONU/ONT tidak valid, rename ke OLT dibatalkan.",
      }
    }

    const snmp = await import("net-snmp")
    const oids = hsgqGponOids
    const session = createSnmpWriteSession(snmp, olt)
    const targetOid = `${oids.ontName}.${deviceIndex}`

    try {
      await new Promise<void>((resolve, reject) => {
        sessionSet(session, snmp.ObjectType.OctetString, targetOid, cleanName, (error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })

      return {
        ok: true,
        syncedToDevice: true,
        message: `Nama ${onu.serialNumber} berhasil diubah di aplikasi dan OLT.`,
      }
    } catch (error) {
      return {
        ok: false,
        syncedToDevice: false,
        message: error instanceof Error ? `Rename ke OLT gagal: ${error.message}` : "Rename ke OLT gagal.",
      }
    } finally {
      session.close()
    }
  }

  return {
    ok: true,
    syncedToDevice: false,
    message: `Nama tersimpan di aplikasi. Metode ${olt.writeMode.toUpperCase()} untuk ${onu.serialNumber} siap disambungkan ke adapter vendor.`,
  }
}
