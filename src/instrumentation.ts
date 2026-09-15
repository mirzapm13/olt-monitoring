export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { startTelegramBotWorker } = await import("@/lib/telegram-worker")

    startTelegramBotWorker()
  }
}
