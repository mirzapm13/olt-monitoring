import { db } from "@/lib/db"
import type { Alert, MonitoringState, Olt, Onu, TelegramSettings } from "@/lib/types"

export const emptyMonitoringState: MonitoringState = {
  olts: [],
  onus: [],
  alerts: [],
  settings: {
    telegram: {
      enabled: false,
      botToken: "",
      chatId: "",
      notifyOntDown: true,
      notifyRecovery: true,
      botPollingEnabled: false,
      lastUpdateId: 0,
    },
  },
}

export function normalizeMonitoringState(state: Partial<MonitoringState>): MonitoringState {
  return {
    olts: Array.isArray(state.olts) ? state.olts : [],
    onus: Array.isArray(state.onus) ? state.onus : [],
    alerts: Array.isArray(state.alerts) ? state.alerts : [],
    settings: {
      telegram: {
        ...emptyMonitoringState.settings.telegram,
        ...(state.settings?.telegram ?? {}),
      },
    },
  }
}

export async function readMonitoringState(): Promise<MonitoringState> {
  try {
    const [dbOlts, dbOnus, dbAlerts, telegramRow] = await Promise.all([
      db.olt.findMany({ orderBy: { id: "asc" } }),
      db.onu.findMany({ orderBy: [{ oltId: "asc" }, { ponPort: "asc" }, { onuIndex: "asc" }] }),
      db.alert.findMany({ orderBy: { storedAt: "desc" } }),
      db.telegramSetting.findUnique({ where: { id: 1 } }),
    ])

    const olts: Olt[] = dbOlts.map((row) => ({
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
    }))

    const onus: Onu[] = dbOnus.map((row) => ({
      id: row.id,
      oltId: row.oltId,
      name: row.name,
      serialNumber: row.serialNumber,
      ponPort: row.ponPort,
      onuIndex: row.onuIndex,
      status: row.status as Onu["status"],
      rxPower: row.rxPower,
      txPower: row.txPower,
      temperatureC: row.temperatureC,
      downReason: row.downReason,
      distanceMeters: row.distanceMeters,
      lastSeen: row.lastSeen,
      syncStatus: row.syncStatus as Onu["syncStatus"],
    }))

    const alerts: Alert[] = dbAlerts.map((row) => ({
      id: row.id,
      oltId: row.oltId,
      title: row.title,
      detail: row.detail,
      severity: row.severity as Alert["severity"],
      createdAt: row.createdAt,
      acknowledged: row.acknowledged,
    }))

    const telegram: TelegramSettings = {
      enabled: telegramRow?.enabled ?? false,
      botToken: telegramRow?.botToken ?? "",
      chatId: telegramRow?.chatId ?? "",
      notifyOntDown: telegramRow?.notifyOntDown ?? true,
      notifyRecovery: telegramRow?.notifyRecovery ?? true,
      botPollingEnabled: telegramRow?.botPollingEnabled ?? false,
      lastUpdateId: telegramRow?.lastUpdateId ?? 0,
    }

    return {
      olts,
      onus,
      alerts,
      settings: { telegram },
    }
  } catch (error) {
    console.error("Failed to read state from PostgreSQL:", error)
    return emptyMonitoringState
  }
}

export async function writeMonitoringState(state: MonitoringState) {
  const norm = normalizeMonitoringState(state)

  try {
    // 1. Sync OLTs
    const oltIdsInState = norm.olts.map((o) => o.id)
    await db.olt.deleteMany({
      where: { id: { notIn: oltIdsInState } },
    })

    for (const olt of norm.olts) {
      await db.olt.upsert({
        where: { id: olt.id },
        update: {
          name: olt.name,
          ipAddress: olt.ipAddress,
          vendor: olt.vendor,
          model: olt.model || "",
          location: olt.location || "",
          status: olt.status || "offline",
          uptime: olt.uptime || "0",
          cpuLoad: olt.cpuLoad || 0,
          memoryLoad: olt.memoryLoad || 0,
          ponPorts: olt.ponPorts || 0,
          activeOnu: olt.activeOnu || 0,
          pollingInterval: olt.pollingInterval || 60,
          snmpVersion: olt.snmpVersion || "v2c",
          snmpPort: olt.snmpPort || 161,
          readCommunity: olt.readCommunity,
          writeCommunity: olt.writeCommunity || null,
          oidProfile: olt.oidProfile,
          writeMode: olt.writeMode || "none",
          lastSeen: olt.lastSeen || "Belum pernah",
          systemInfo: olt.systemInfo ? (olt.systemInfo as Record<string, string>) : undefined,
        },
        create: {
          id: olt.id,
          name: olt.name,
          ipAddress: olt.ipAddress,
          vendor: olt.vendor,
          model: olt.model || "",
          location: olt.location || "",
          status: olt.status || "offline",
          uptime: olt.uptime || "0",
          cpuLoad: olt.cpuLoad || 0,
          memoryLoad: olt.memoryLoad || 0,
          ponPorts: olt.ponPorts || 0,
          activeOnu: olt.activeOnu || 0,
          pollingInterval: olt.pollingInterval || 60,
          snmpVersion: olt.snmpVersion || "v2c",
          snmpPort: olt.snmpPort || 161,
          readCommunity: olt.readCommunity,
          writeCommunity: olt.writeCommunity || null,
          oidProfile: olt.oidProfile,
          writeMode: olt.writeMode || "none",
          lastSeen: olt.lastSeen || "Belum pernah",
          systemInfo: olt.systemInfo ? (olt.systemInfo as Record<string, string>) : undefined,
        },
      })
    }

    // 2. Sync ONUs
    const onuIdsInState = norm.onus.map((o) => o.id)
    await db.onu.deleteMany({
      where: { id: { notIn: onuIdsInState } },
    })

    for (const onu of norm.onus) {
      await db.onu.upsert({
        where: { id: onu.id },
        update: {
          oltId: onu.oltId,
          name: onu.name,
          serialNumber: onu.serialNumber,
          ponPort: onu.ponPort,
          onuIndex: onu.onuIndex,
          status: onu.status,
          rxPower: onu.rxPower,
          txPower: onu.txPower,
          temperatureC: onu.temperatureC ?? null,
          downReason: onu.downReason ?? null,
          distanceMeters: onu.distanceMeters || 0,
          lastSeen: onu.lastSeen || "Baru saja",
          syncStatus: onu.syncStatus || "synced",
        },
        create: {
          id: onu.id,
          oltId: onu.oltId,
          name: onu.name,
          serialNumber: onu.serialNumber,
          ponPort: onu.ponPort,
          onuIndex: onu.onuIndex,
          status: onu.status,
          rxPower: onu.rxPower,
          txPower: onu.txPower,
          temperatureC: onu.temperatureC ?? null,
          downReason: onu.downReason ?? null,
          distanceMeters: onu.distanceMeters || 0,
          lastSeen: onu.lastSeen || "Baru saja",
          syncStatus: onu.syncStatus || "synced",
        },
      })
    }

    // 3. Sync Alerts
    const alertIdsInState = norm.alerts.map((a) => a.id)
    await db.alert.deleteMany({
      where: { id: { notIn: alertIdsInState } },
    })

    for (const alert of norm.alerts) {
      await db.alert.upsert({
        where: { id: alert.id },
        update: {
          oltId: alert.oltId,
          title: alert.title,
          detail: alert.detail,
          severity: alert.severity,
          acknowledged: alert.acknowledged,
          createdAt: alert.createdAt,
        },
        create: {
          id: alert.id,
          oltId: alert.oltId,
          title: alert.title,
          detail: alert.detail,
          severity: alert.severity,
          acknowledged: alert.acknowledged,
          createdAt: alert.createdAt,
        },
      })
    }

    // 4. Sync Telegram Settings
    if (norm.settings?.telegram) {
      const t = norm.settings.telegram
      await db.telegramSetting.upsert({
        where: { id: 1 },
        update: {
          enabled: t.enabled,
          botToken: t.botToken,
          chatId: t.chatId,
          notifyOntDown: t.notifyOntDown,
          notifyRecovery: t.notifyRecovery,
          botPollingEnabled: t.botPollingEnabled,
          lastUpdateId: t.lastUpdateId,
        },
        create: {
          id: 1,
          enabled: t.enabled,
          botToken: t.botToken,
          chatId: t.chatId,
          notifyOntDown: t.notifyOntDown,
          notifyRecovery: t.notifyRecovery,
          botPollingEnabled: t.botPollingEnabled,
          lastUpdateId: t.lastUpdateId,
        },
      })
    }
  } catch (error) {
    console.error("Failed to write state to PostgreSQL:", error)
  }

  return norm
}
