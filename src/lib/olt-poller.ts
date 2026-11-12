import { db } from "@/lib/db"
import { readMonitoringState, writeSingleOltPollResult } from "@/lib/server-db"
import { pollOnusFromOlt } from "@/lib/snmp"
import { notifyOltStatusChange, notifyOnuStatusChanges } from "@/lib/telegram"
import type { Alert, MonitoringState, Olt, Onu } from "@/lib/types"

type FailedPollRecord = {
  oltId: string
  oltName: string
  message: string
  failedAt: string
}

type SuccessfulPollRecord = {
  oltId: string
  oltName: string
  onuCount: number
  onlineCount: number
  polledAt: string
}

type PollerGlobal = typeof globalThis & {
  __mikroinActivePolls?: Set<string>
  __mikroinFailedPolls?: Map<string, FailedPollRecord>
  __mikroinSuccessfulPolls?: Map<string, SuccessfulPollRecord>
  __mikroinLastPolledEpoch?: Map<string, number>
  __mikroinLastStateChangeAt?: number
  __mikroinSnmpWorkerStarted?: boolean
}

const g = globalThis as PollerGlobal

export const activePolls = g.__mikroinActivePolls ?? (g.__mikroinActivePolls = new Set<string>())
export const failedPolls = g.__mikroinFailedPolls ?? (g.__mikroinFailedPolls = new Map<string, FailedPollRecord>())
export const successfulPolls =
  g.__mikroinSuccessfulPolls ?? (g.__mikroinSuccessfulPolls = new Map<string, SuccessfulPollRecord>())
export const lastPolledEpoch =
  g.__mikroinLastPolledEpoch ?? (g.__mikroinLastPolledEpoch = new Map<string, number>())

if (g.__mikroinLastStateChangeAt === undefined) {
  g.__mikroinLastStateChangeAt = Date.now()
}

export function getLastStateChangeAt(): number {
  return g.__mikroinLastStateChangeAt ?? 0
}

export function bumpStateChangeAt() {
  g.__mikroinLastStateChangeAt = Date.now()
}

export function nowJakarta() {
  return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
}

function formatRxPower(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-"
  return `${value} dBm`
}

function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-"
  return `${value} C`
}

function buildOnuAlertDetail(onu: Onu, olt: Olt, eventTime: string, eventLabel: string) {
  const link = onu.customerLink
  const customerPart = link?.namaPelanggan
    ? `Pelanggan Billing: ${link.namaPelanggan}${link.idPelanggan ? ` (${link.idPelanggan})` : ""}`
    : null
  const pppoePart = link?.ipSecret ? `PPPoE: ${link.ipSecret} @ ${link.routerName}` : null

  return [
    `Nama ONU: ${onu.name}`,
    customerPart,
    pppoePart,
    `OLT: ${olt.name}`,
    `PON: ${onu.ponPort}:${onu.onuIndex}`,
    `Serial: ${onu.serialNumber || "-"}`,
    `Status: ${onu.status}`,
    `RX: ${formatRxPower(onu.rxPower)}`,
    `Suhu: ${formatTemperature(onu.temperatureC)}`,
    `Kasus Down: ${onu.status === "online" ? "-" : onu.downReason || "Down"}`,
    `Last Seen: ${onu.lastSeen}`,
    `Event: ${eventLabel}`,
    `Waktu Event: ${eventTime}`,
  ]
    .filter(Boolean)
    .join(" | ")
}

function latestSavedOnuEvent(state: MonitoringState, onuId: string) {
  const latest = state.alerts.find(
    (alert) => alert.id.startsWith(`onu-${onuId}-down-`) || alert.id.startsWith(`onu-${onuId}-recovery-`),
  )
  if (!latest) return null
  if (latest.id.startsWith(`onu-${onuId}-down-`)) return "down"
  if (latest.id.startsWith(`onu-${onuId}-recovery-`)) return "recovery"
  return null
}

function latestSavedOltEvent(state: MonitoringState, oltId: string) {
  const latest = state.alerts.find(
    (alert) => alert.id.startsWith(`olt-${oltId}-down-`) || alert.id.startsWith(`olt-${oltId}-recovery-`),
  )
  if (!latest) return null
  if (latest.id.startsWith(`olt-${oltId}-down-`)) return "down"
  if (latest.id.startsWith(`olt-${oltId}-recovery-`)) return "recovery"
  return null
}

function buildOltAlertDetail(olt: Olt, eventTime: string, eventLabel: string, errorMessage?: string) {
  return [
    `Nama OLT: ${olt.name}`,
    `IP: ${olt.ipAddress}:${olt.snmpPort || 161}`,
    `Vendor: ${olt.vendor}`,
    `Tipe: ${olt.model || "-"}`,
    `Lokasi: ${olt.location || "-"}`,
    `Event: ${eventLabel}`,
    errorMessage ? `Error: ${errorMessage}` : null,
    `Waktu Event: ${eventTime}`,
  ]
    .filter(Boolean)
    .join(" | ")
}

function buildOltTransitionAlert(
  state: MonitoringState,
  olt: Olt,
  status: "down" | "recovery",
  errorMessage?: string,
) {
  if (latestSavedOltEvent(state, olt.id) === status) return null

  const eventTime = nowJakarta()

  return {
    id: `olt-${olt.id}-${status}-${Date.now()}`,
    oltId: olt.id,
    title: status === "down" ? `OLT down: ${olt.name}` : `OLT recovery: ${olt.name}`,
    detail: buildOltAlertDetail(
      olt,
      eventTime,
      status === "down" ? "Down terdeteksi" : "Recovery terdeteksi",
      errorMessage,
    ),
    severity: status === "down" ? ("critical" as const) : ("info" as const),
    createdAt: eventTime,
    acknowledged: status === "recovery",
  }
}

function buildTransitionAlerts(state: MonitoringState, olt: Olt, nextOnus: Onu[]) {
  const previousById = new Map(state.onus.filter((onu) => onu.oltId === olt.id).map((onu) => [onu.id, onu]))
  const eventTime = nowJakarta()
  const alerts: Alert[] = []
  const recoveredOnuIds: string[] = []

  for (const onu of nextOnus) {
    const previous = previousById.get(onu.id)
    if (!previous) continue

    const wasOnline = previous.status === "online"
    const isOnline = onu.status === "online"

    if (wasOnline && !isOnline) {
      if (latestSavedOnuEvent(state, onu.id) === "down") continue

      alerts.push({
        id: `onu-${onu.id}-down-${Date.now()}`,
        oltId: olt.id,
        title: `ONT down: ${onu.name}`,
        detail: buildOnuAlertDetail(onu, olt, eventTime, "Down terdeteksi"),
        severity: "critical",
        createdAt: eventTime,
        acknowledged: false,
      })
      continue
    }

    if (!wasOnline && isOnline) {
      if (latestSavedOnuEvent(state, onu.id) === "recovery") continue

      recoveredOnuIds.push(onu.id)
      alerts.push({
        id: `onu-${onu.id}-recovery-${Date.now()}`,
        oltId: olt.id,
        title: `ONT recovery: ${onu.name}`,
        detail: buildOnuAlertDetail(onu, olt, eventTime, "Recovery terdeteksi"),
        severity: "info",
        createdAt: eventTime,
        acknowledged: true,
      })
    }
  }

  return { alerts, recoveredOnuIds }
}

function keepLocalVsolNames(state: MonitoringState, olt: Olt, nextOnus: Onu[]) {
  const previousById = new Map(state.onus.filter((onu) => onu.oltId === olt.id).map((onu) => [onu.id, onu]))

  return nextOnus.map((onu) => {
    const previous = previousById.get(onu.id)
    const shouldKeepLocalName =
      olt.oidProfile === "vsol-gpon" &&
      previous &&
      previous.name &&
      previous.name !== onu.name &&
      (previous.syncStatus === "pending" || previous.syncStatus === "local-only")

    return {
      ...onu,
      name: shouldKeepLocalName && previous ? previous.name : onu.name,
      syncStatus: shouldKeepLocalName && previous ? previous.syncStatus : onu.syncStatus,
      customerLink: previous?.customerLink ?? onu.customerLink ?? null,
    }
  })
}

export async function pollSingleOlt(requestedOlt: Olt) {
  const lockKey = requestedOlt.id || `${requestedOlt.ipAddress}:${requestedOlt.snmpPort || 161}`

  if (activePolls.has(lockKey)) {
    return {
      alreadyActive: true,
      ok: false,
      message: `Polling ${requestedOlt.name || requestedOlt.ipAddress} masih berjalan. Request dobel dilewati agar notifikasi tidak berulang.`,
      onus: [] as Onu[],
    }
  }

  activePolls.add(lockKey)
  lastPolledEpoch.set(lockKey, Date.now())

  try {
    const initialState = await readMonitoringState()
    const savedOlt = initialState.olts.find((item) => item.id === requestedOlt.id)

    if (requestedOlt.id && !savedOlt) {
      return {
        alreadyActive: false,
        ok: false,
        message: `${requestedOlt.name || requestedOlt.ipAddress} sudah tidak ada di database. Hasil polling lama dilewati.`,
        onus: [] as Onu[],
      }
    }

    const pollingOlt = savedOlt ?? requestedOlt
    const result = await pollOnusFromOlt(pollingOlt)
    const state = await readMonitoringState()
    const olt = state.olts.find((item) => item.id === pollingOlt.id)

    if (!olt) {
      return {
        alreadyActive: false,
        ...result,
        ok: false,
        message: `${pollingOlt.name || pollingOlt.ipAddress} sudah dihapus. Hasil polling tidak disimpan agar data lama tidak muncul lagi.`,
        onus: [] as Onu[],
        state,
      }
    }

    if (result.ok) {
      const oltWasOffline = olt.status === "offline"
      const polledOnus = keepLocalVsolNames(state, olt, result.onus ?? [])
      let notification = {
        checked: polledOnus.length,
        downDetected: 0,
        recoveryDetected: 0,
        sent: 0,
        failed: 0,
        skipped: false,
        message: "Notifikasi Telegram belum dicek.",
      }

      try {
        if (oltWasOffline) {
          const oltNotification = await notifyOltStatusChange(state, olt, "recovery")
          notification.sent += oltNotification.sent
          notification.failed += oltNotification.failed
          if (oltNotification.sent > 0 || oltNotification.failed > 0) notification.message = oltNotification.message
        }
        const onuNotification = await notifyOnuStatusChanges(state, olt, polledOnus)
        notification = {
          ...onuNotification,
          sent: notification.sent + onuNotification.sent,
          failed: notification.failed + onuNotification.failed,
          message:
            notification.sent > 0 || notification.failed > 0
              ? `${notification.message} ${onuNotification.sent > 0 || onuNotification.failed > 0 ? onuNotification.message : ""}`.trim()
              : onuNotification.message,
        }
      } catch (error) {
        notification = {
          ...notification,
          failed: notification.failed + 1,
          message: error instanceof Error ? `Telegram gagal: ${error.message}` : "Telegram gagal mengirim notifikasi.",
        }
      }

      const transition = buildTransitionAlerts(state, olt, polledOnus)
      const oltRecoveryAlert = oltWasOffline ? buildOltTransitionAlert(state, olt, "recovery") : null
      const polledAt = nowJakarta()
      const onlineCount = polledOnus.filter((onu) => onu.status === "online").length
      const timestampedOnus = polledOnus.map((onu) => ({ ...onu, lastSeen: polledAt }))
      const mergedSystemInfo = result.health?.systemInfoPatch
        ? { ...(olt.systemInfo ?? {}), ...result.health.systemInfoPatch }
        : undefined

      const savedState = await writeSingleOltPollResult({
        oltId: olt.id,
        status: "online",
        activeOnu: onlineCount,
        cpuLoad: result.health?.cpuLoad,
        memoryLoad: result.health?.memoryLoad,
        uptime: result.health?.uptime,
        systemInfo: mergedSystemInfo,
        lastSeen: polledAt,
        onus: timestampedOnus,
        newAlerts: [...(oltRecoveryAlert ? [oltRecoveryAlert] : []), ...transition.alerts],
        acknowledgeOnuIds: transition.recoveredOnuIds,
        acknowledgeOltDown: oltWasOffline,
      })

      failedPolls.delete(olt.id)
      successfulPolls.set(olt.id, {
        oltId: olt.id,
        oltName: olt.name,
        onuCount: timestampedOnus.length,
        onlineCount,
        polledAt,
      })
      bumpStateChangeAt()

      return {
        alreadyActive: false,
        ...result,
        polledAt,
        onus: timestampedOnus,
        state: savedState,
        notification,
      }
    }

    const failedAt = nowJakarta()
    failedPolls.set(olt.id, {
      oltId: olt.id,
      oltName: olt.name,
      message: result.message || "Polling SNMP ke OLT gagal.",
      failedAt,
    })

    const oltDownAlert = buildOltTransitionAlert(state, olt, "down", result.message)
    let notification = {
      sent: 0,
      failed: 0,
      skipped: false,
      message: "Notifikasi OLT belum dicek.",
    }

    try {
      notification = await notifyOltStatusChange(state, olt, "down", result.message)
    } catch (error) {
      notification = {
        ...notification,
        failed: notification.failed + 1,
        message: error instanceof Error ? `Telegram gagal: ${error.message}` : "Telegram gagal mengirim notifikasi OLT.",
      }
    }

    const savedState = await writeSingleOltPollResult({
      oltId: olt.id,
      status: "offline",
      lastSeen: `Gagal: ${failedAt}`,
      newAlerts: oltDownAlert ? [oltDownAlert] : [],
    })
    bumpStateChangeAt()

    return {
      alreadyActive: false,
      ...result,
      state: savedState,
      notification,
    }
  } finally {
    activePolls.delete(lockKey)
    lastPolledEpoch.set(lockKey, Date.now())
  }
}

export function startSnmpPollingWorker() {
  if (g.__mikroinSnmpWorkerStarted) return
  g.__mikroinSnmpWorkerStarted = true

  async function tick() {
    try {
      const dbOlts = await db.olt.findMany({ orderBy: { id: "asc" } })
      const now = Date.now()

      dbOlts.forEach((row, index) => {
        if (activePolls.has(row.id)) return
        const intervalMs = Math.max(15, Number(row.pollingInterval) || 60) * 1000
        const lastEpoch = lastPolledEpoch.get(row.id) ?? 0
        if (now - lastEpoch < intervalMs) return

        lastPolledEpoch.set(row.id, now)
        const olt: Olt = {
          id: row.id,
          name: row.name,
          ipAddress: row.ipAddress,
          vendor: row.vendor as Olt["vendor"],
          model: row.model,
          location: row.location,
          status: row.status as Olt["status"],
          uptime: row.uptime,
          cpuLoad: row.cpuLoad,
          memoryLoad: row.memoryLoad,
          ponPorts: row.ponPorts,
          activeOnu: row.activeOnu,
          pollingInterval: row.pollingInterval,
          snmpVersion: row.snmpVersion as Olt["snmpVersion"],
          snmpPort: row.snmpPort,
          readCommunity: row.readCommunity,
          writeCommunity: row.writeCommunity ?? undefined,
          oidProfile: row.oidProfile as Olt["oidProfile"],
          writeMode: row.writeMode as Olt["writeMode"],
          lastSeen: row.lastSeen,
          systemInfo: row.systemInfo ? (row.systemInfo as Record<string, string>) : undefined,
        }

        // Stagger concurrent OLT polls by 400ms each to smooth network & DB spikes
        setTimeout(() => {
          void pollSingleOlt(olt).catch((err) => {
            console.warn(`Background SNMP poll failed for ${olt.name}:`, err)
          })
        }, index * 400)
      })
    } catch (error) {
      console.warn(error instanceof Error ? `SNMP polling worker error: ${error.message}` : "SNMP polling worker error.")
    }
  }

  setTimeout(() => void tick(), 3000)
  setInterval(() => void tick(), 5000)
}
