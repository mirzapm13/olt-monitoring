import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { MonitoringState } from "@/lib/types"

const dbPath = path.join(process.cwd(), "data", "monitoring-db.json")

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
    const raw = await readFile(dbPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<MonitoringState>

    return normalizeMonitoringState(parsed)
  } catch {
    return emptyMonitoringState
  }
}

export async function writeMonitoringState(state: MonitoringState) {
  await mkdir(path.dirname(dbPath), { recursive: true })
  await writeFile(dbPath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  return state
}
