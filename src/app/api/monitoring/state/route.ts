import { NextResponse } from "next/server"

import { emptyMonitoringState, normalizeMonitoringState, readMonitoringState, writeMonitoringState } from "@/lib/server-db"
import type { MonitoringState } from "@/lib/types"

export const runtime = "nodejs"

export async function GET() {
  const state = await readMonitoringState()

  return NextResponse.json(state)
}

export async function PUT(request: Request) {
  const body = (await request.json()) as MonitoringState
  const state = await writeMonitoringState(normalizeMonitoringState(body))

  return NextResponse.json(state)
}

export async function DELETE() {
  const state = await writeMonitoringState(emptyMonitoringState)

  return NextResponse.json(state)
}
