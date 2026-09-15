import { NextResponse } from "next/server"

import { readMonitoringState, writeMonitoringState } from "@/lib/server-db"
import { processTelegramUpdates } from "@/lib/telegram"

export const runtime = "nodejs"

export async function POST() {
  const state = await readMonitoringState()
  const result = await processTelegramUpdates(state)

  if (result.state !== state) {
    await writeMonitoringState(result.state)
  }

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    message: result.message,
  })
}
