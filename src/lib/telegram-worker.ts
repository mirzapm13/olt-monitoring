import { readMonitoringState, writeMonitoringState } from "@/lib/server-db"
import { processTelegramUpdates } from "@/lib/telegram"

const workerIntervalMs = 5000

type MikroinGlobal = typeof globalThis & {
  __mikroinTelegramWorkerStarted?: boolean
}

export function startTelegramBotWorker() {
  const globalState = globalThis as MikroinGlobal
  if (globalState.__mikroinTelegramWorkerStarted) return
  globalState.__mikroinTelegramWorkerStarted = true

  async function tick() {
    try {
      const state = await readMonitoringState()
      if (!state.settings.telegram.enabled || !state.settings.telegram.botPollingEnabled) return

      const result = await processTelegramUpdates(state)
      if (result.state !== state) await writeMonitoringState(result.state)
    } catch (error) {
      console.warn(error instanceof Error ? `Telegram bot worker gagal: ${error.message}` : "Telegram bot worker gagal.")
    }
  }

  void tick()
  setInterval(() => void tick(), workerIntervalMs)
}
