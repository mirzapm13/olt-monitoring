import { NextResponse } from "next/server"

import { runCustomerOnuSync } from "@/lib/customer-onu-sync"
import { readMonitoringState } from "@/lib/server-db"

export const runtime = "nodejs"

let syncInProgress = false

export async function POST() {
  if (syncInProgress) {
    return NextResponse.json(
      { ok: false, message: "Proses sync Mikrotik & Customer sedang berjalan." },
      { status: 409 }
    )
  }

  syncInProgress = true
  try {
    const result = await runCustomerOnuSync()
    const state = await readMonitoringState()
    return NextResponse.json({
      ...result,
      state,
    })
  } catch (error) {
    console.error("Failed to sync customer & Mikrotik ONUs:", error)
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Gagal melakukan sync Mikrotik & Customer",
      },
      { status: 500 }
    )
  } finally {
    syncInProgress = false
  }
}
