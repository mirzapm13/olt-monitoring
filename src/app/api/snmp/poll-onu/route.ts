import { NextResponse } from "next/server"

import { readMonitoringState, writeMonitoringState } from "@/lib/server-db"
import { pollOnusFromOlt } from "@/lib/snmp"
import { notifyOltStatusChange, notifyOnuStatusChanges } from "@/lib/telegram"
import type { Alert, MonitoringState, Olt, Onu } from "@/lib/types"

export const runtime = "nodejs"

const activePolls = new Set<string>()

function formatRxPower(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-"
  return `${value} dBm`
}

function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-"
  return `${value} C`
}

function buildOnuAlertDetail(onu: Onu, olt: Olt, eventTime: string, eventLabel: string) {
  return [
    `Nama pelanggan: ${onu.name}`,
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
  ].join(" | ")
}

function latestSavedOnuEvent(state: MonitoringState, onuId: string) {
  const latest = state.alerts.find((alert) => alert.id.startsWith(`onu-${onuId}-down-`) || alert.id.startsWith(`onu-${onuId}-recovery-`))
  if (!latest) return null
  if (latest.id.startsWith(`onu-${onuId}-down-`)) return "down"
  if (latest.id.startsWith(`onu-${onuId}-recovery-`)) return "recovery"
  return null
}

function latestSavedOltEvent(state: MonitoringState, oltId: string) {
  const latest = state.alerts.find((alert) => alert.id.startsWith(`olt-${oltId}-down-`) || alert.id.startsWith(`olt-${oltId}-recovery-`))
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

function buildOltTransitionAlert(state: MonitoringState, olt: Olt, status: "down" | "recovery", errorMessage?: string) {
  if (latestSavedOltEvent(state, olt.id) === status) return null

  const eventTime = new Date().toLocaleString("id-ID")

  return {
    id: `olt-${olt.id}-${status}-${Date.now()}`,
    oltId: olt.id,
    title: status === "down" ? `OLT down: ${olt.name}` : `OLT recovery: ${olt.name}`,
    detail: buildOltAlertDetail(olt, eventTime, status === "down" ? "Down terdeteksi" : "Recovery terdeteksi", errorMessage),
    severity: status === "down" ? ("critical" as const) : ("info" as const),
    createdAt: eventTime,
    acknowledged: status === "recovery",
  }
}

function buildTransitionAlerts(state: MonitoringState, olt: Olt, nextOnus: Onu[]) {
  const previousById = new Map(state.onus.filter((onu) => onu.oltId === olt.id).map((onu) => [onu.id, onu]))
  const eventTime = new Date().toLocaleString("id-ID")
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
  if (olt.oidProfile !== "vsol-gpon") return nextOnus

  const previousById = new Map(state.onus.filter((onu) => onu.oltId === olt.id).map((onu) => [onu.id, onu]))

  return nextOnus.map((onu) => {
    const previous = previousById.get(onu.id)
    const shouldKeepLocalName =
      previous &&
      previous.name &&
      previous.name !== onu.name &&
      (previous.syncStatus === "pending" || previous.syncStatus === "local-only")

    if (!shouldKeepLocalName) return onu

    return {
      ...onu,
      name: previous.name,
      syncStatus: previous.syncStatus,
    }
  })
}

export async function POST(request: Request) {
  const requestedOlt = (await request.json()) as Olt
  const lockKey = requestedOlt.id || `${requestedOlt.ipAddress}:${requestedOlt.snmpPort || 161}`

  if (activePolls.has(lockKey)) {
    return NextResponse.json(
      {
        ok: false,
        message: `Polling ${requestedOlt.name || requestedOlt.ipAddress} masih berjalan. Request dobel dilewati agar notifikasi tidak berulang.`,
        onus: [],
      },
      { status: 409 },
    )
  }

  activePolls.add(lockKey)

  try {
    const initialState = await readMonitoringState()
    const savedOlt = initialState.olts.find((item) => item.id === requestedOlt.id)

    if (requestedOlt.id && !savedOlt) {
      return NextResponse.json(
        {
          ok: false,
          message: `${requestedOlt.name || requestedOlt.ipAddress} sudah tidak ada di database. Hasil polling lama dilewati.`,
          onus: [],
        },
        { status: 200 },
      )
    }

    const pollingOlt = savedOlt ?? requestedOlt
    const result = await pollOnusFromOlt(pollingOlt)
    const state = await readMonitoringState()
    const olt = state.olts.find((item) => item.id === pollingOlt.id)

    if (!olt) {
      return NextResponse.json(
        {
          ...result,
          ok: false,
          message: `${pollingOlt.name || pollingOlt.ipAddress} sudah dihapus. Hasil polling tidak disimpan agar data lama tidak muncul lagi.`,
          onus: [],
          state,
        },
        { status: 200 },
      )
    }

    if (result.ok) {
      const oltWasOffline = state.olts.find((item) => item.id === olt.id)?.status === "offline"
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
        // Notification failure should not break SNMP polling.
        notification = {
          ...notification,
          failed: notification.failed + 1,
          message: error instanceof Error ? `Telegram gagal: ${error.message}` : "Telegram gagal mengirim notifikasi.",
        }
      }

      const transition = buildTransitionAlerts(state, olt, polledOnus)
      const oltRecoveryAlert = oltWasOffline ? buildOltTransitionAlert(state, olt, "recovery") : null
      const acknowledgedOldAlerts = state.alerts.map((alert) =>
        transition.recoveredOnuIds.some((onuId) => alert.id.startsWith(`onu-${onuId}-down-`)) || (oltWasOffline && alert.id.startsWith(`olt-${olt.id}-down-`))
          ? { ...alert, acknowledged: true }
          : alert,
      )
      const nextOnus = [...state.onus.filter((onu) => onu.oltId !== olt.id), ...polledOnus]
      const nextState = {
        ...state,
        onus: nextOnus,
        alerts: [...(oltRecoveryAlert ? [oltRecoveryAlert] : []), ...transition.alerts, ...acknowledgedOldAlerts].slice(0, 300),
        olts: state.olts.map((item) =>
          item.id === olt.id
            ? {
                ...item,
                status: "online" as const,
                activeOnu: polledOnus.filter((onu) => onu.status === "online").length,
                lastSeen: "Baru saja",
              }
            : item,
        ),
      }
      const savedState = await writeMonitoringState(nextState)

      return NextResponse.json({ ...result, onus: polledOnus, state: savedState, notification })
    }

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

    const nextState = {
      ...state,
      alerts: [...(oltDownAlert ? [oltDownAlert] : []), ...state.alerts].slice(0, 300),
      olts: state.olts.map((item) =>
        item.id === olt.id
          ? {
              ...item,
              status: "offline" as const,
              lastSeen: `Gagal: ${new Date().toLocaleString("id-ID")}`,
            }
          : item,
      ),
    }
    const savedState = await writeMonitoringState(nextState)

    return NextResponse.json({ ...result, state: savedState, notification }, { status: 200 })
  } finally {
    activePolls.delete(lockKey)
  }
}
