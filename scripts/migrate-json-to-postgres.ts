import { readFile } from "node:fs/promises"
import path from "node:path"
import { db } from "../src/lib/db"
import type { MonitoringState } from "../src/lib/types"

async function migrate() {
  console.log("=== Migrating data from monitoring-db.json to PostgreSQL (olt_db) ===")
  const jsonPath = path.join(process.cwd(), "data", "monitoring-db.json")

  try {
    const raw = await readFile(jsonPath, "utf8")
    const state = JSON.parse(raw) as Partial<MonitoringState>

    const olts = Array.isArray(state.olts) ? state.olts : []
    const onus = Array.isArray(state.onus) ? state.onus : []
    const alerts = Array.isArray(state.alerts) ? state.alerts : []
    const telegram = state.settings?.telegram

    console.log(`Found ${olts.length} OLTs, ${onus.length} ONUs, ${alerts.length} Alerts in JSON file.`)

    // 1. Migrate OLTs
    for (const olt of olts) {
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
    console.log(`Successfully migrated ${olts.length} OLTs.`)

    // 2. Migrate ONUs
    for (const onu of onus) {
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
    console.log(`Successfully migrated ${onus.length} ONUs.`)

    // 3. Migrate Alerts
    for (const alert of alerts) {
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
    console.log(`Successfully migrated ${alerts.length} Alerts.`)

    // 4. Migrate Telegram Settings
    if (telegram) {
      await db.telegramSetting.upsert({
        where: { id: 1 },
        update: {
          enabled: telegram.enabled ?? false,
          botToken: telegram.botToken ?? "",
          chatId: telegram.chatId ?? "",
          notifyOntDown: telegram.notifyOntDown ?? true,
          notifyRecovery: telegram.notifyRecovery ?? true,
          botPollingEnabled: telegram.botPollingEnabled ?? false,
          lastUpdateId: telegram.lastUpdateId ?? 0,
        },
        create: {
          id: 1,
          enabled: telegram.enabled ?? false,
          botToken: telegram.botToken ?? "",
          chatId: telegram.chatId ?? "",
          notifyOntDown: telegram.notifyOntDown ?? true,
          notifyRecovery: telegram.notifyRecovery ?? true,
          botPollingEnabled: telegram.botPollingEnabled ?? false,
          lastUpdateId: telegram.lastUpdateId ?? 0,
        },
      })
      console.log("Successfully migrated Telegram settings.")
    }

    console.log("\nMigration completed successfully!")
  } catch (err) {
    console.error("Migration failed or no json file found:", err)
  } finally {
    await db.$disconnect()
  }
}

migrate().catch(console.error)
