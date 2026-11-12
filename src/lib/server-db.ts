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

export function compareOnuOrder(a: Onu, b: Onu): number {
  if (a.oltId !== b.oltId) {
    return a.oltId.localeCompare(b.oltId)
  }
  const ponDiff = String(a.ponPort).localeCompare(String(b.ponPort), undefined, { numeric: true })
  if (ponDiff !== 0) return ponDiff
  return String(a.onuIndex).localeCompare(String(b.onuIndex), undefined, { numeric: true })
}

export function normalizeMonitoringState(state: Partial<MonitoringState>): MonitoringState {
  return {
    olts: Array.isArray(state.olts) ? state.olts : [],
    onus: Array.isArray(state.onus) ? [...state.onus].sort(compareOnuOrder) : [],
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
      db.onu.findMany({
        include: { customerLink: true },
        orderBy: [{ oltId: "asc" }, { ponPort: "asc" }, { onuIndex: "asc" }],
      }),
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

    const onus: Onu[] = dbOnus
      .map((row) => ({
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
        customerLink: row.customerLink
          ? {
              idPelanggan: row.customerLink.idPelanggan,
              namaPelanggan: row.customerLink.namaPelanggan,
              alamat: row.customerLink.alamat,
              tlp: row.customerLink.tlp,
              namaLangganan: row.customerLink.namaLangganan,
              statusLangganan: row.customerLink.statusLangganan,
              ipSecret: row.customerLink.ipSecret,
              routerName: row.customerLink.routerName,
              pppoeMac: row.customerLink.pppoeMac,
              onuMac: row.customerLink.onuMac,
              macSource: row.customerLink.macSource,
              macOffset: row.customerLink.macOffset,
              lastLoggedOut: row.customerLink.lastLoggedOut,
              pppoeAddress: row.customerLink.pppoeAddress,
              syncedAt: row.customerLink.syncedAt.toISOString(),
            }
          : null,
      }))
      .sort(compareOnuOrder)

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

    const onuBatchSize = 200
    for (let i = 0; i < norm.onus.length; i += onuBatchSize) {
      const batch = norm.onus.slice(i, i + onuBatchSize)
      await db.$transaction(
        batch.map((onu) =>
          db.onu.upsert({
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
        )
      )
    }

    // 3. Sync Alerts
    const alertIdsInState = norm.alerts.map((a) => a.id)
    await db.alert.deleteMany({
      where: { id: { notIn: alertIdsInState } },
    })

    if (norm.alerts.length > 0) {
      await db.$transaction(
        norm.alerts.map((alert) =>
          db.alert.upsert({
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
        )
      )
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

export async function writeSingleOltPollResult(input: {
  oltId: string
  status: Olt["status"]
  activeOnu?: number
  cpuLoad?: number
  memoryLoad?: number
  uptime?: string
  systemInfo?: Record<string, string>
  lastSeen: string
  onus?: Onu[]
  newAlerts?: Alert[]
  acknowledgeOnuIds?: string[]
  acknowledgeOltDown?: boolean
}): Promise<MonitoringState> {
  try {
    // 1. Update only the target OLT row
    await db.olt.updateMany({
      where: { id: input.oltId },
      data: {
        status: input.status,
        ...(input.activeOnu !== undefined ? { activeOnu: input.activeOnu } : {}),
        ...(input.cpuLoad !== undefined ? { cpuLoad: input.cpuLoad } : {}),
        ...(input.memoryLoad !== undefined ? { memoryLoad: input.memoryLoad } : {}),
        ...(input.uptime !== undefined ? { uptime: input.uptime } : {}),
        ...(input.systemInfo !== undefined ? { systemInfo: input.systemInfo } : {}),
        lastSeen: input.lastSeen,
      },
    })

    // 2. If ONUs were polled, sync only this OLT's ONUs
    if (input.onus) {
      const onuIds = input.onus.map((o) => o.id)
      await db.onu.deleteMany({
        where: {
          oltId: input.oltId,
          id: { notIn: onuIds },
        },
      })

      const onuBatchSize = 200
      for (let i = 0; i < input.onus.length; i += onuBatchSize) {
        const batch = input.onus.slice(i, i + onuBatchSize)
        await db.$transaction(
          batch.map((onu) =>
            db.onu.upsert({
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
            }),
          ),
        )
      }
    }

    // 3. Acknowledge recovered down alerts for this OLT / its ONUs
    const orFilters: Array<{ id: { startsWith: string } }> = []
    if (input.acknowledgeOltDown) {
      orFilters.push({ id: { startsWith: `olt-${input.oltId}-down-` } })
    }
    if (input.acknowledgeOnuIds && input.acknowledgeOnuIds.length > 0) {
      for (const onuId of input.acknowledgeOnuIds) {
        orFilters.push({ id: { startsWith: `onu-${onuId}-down-` } })
      }
    }
    if (orFilters.length > 0) {
      await db.alert.updateMany({
        where: {
          oltId: input.oltId,
          acknowledged: false,
          OR: orFilters,
        },
        data: { acknowledged: true },
      })
    }

    // 4. Insert new transition alerts & cap total stored alerts at 300
    if (input.newAlerts && input.newAlerts.length > 0) {
      await db.$transaction(
        input.newAlerts.map((alert) =>
          db.alert.upsert({
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
          }),
        ),
      )

      const oldAlerts = await db.alert.findMany({
        orderBy: { storedAt: "desc" },
        skip: 300,
        select: { id: true },
      })
      if (oldAlerts.length > 0) {
        await db.alert.deleteMany({
          where: { id: { in: oldAlerts.map((a) => a.id) } },
        })
      }
    }
  } catch (error) {
    console.error(`Failed to write poll result for OLT ${input.oltId}:`, error)
  }

  return readMonitoringState()
}
