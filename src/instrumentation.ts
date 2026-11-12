export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const [{ startTelegramBotWorker }, { startSnmpPollingWorker }] = await Promise.all([
      import("@/lib/telegram-worker"),
      import("@/lib/olt-poller"),
    ])

    startTelegramBotWorker()
    startSnmpPollingWorker()
  }
}
