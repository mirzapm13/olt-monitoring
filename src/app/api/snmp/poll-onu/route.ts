import { NextResponse } from "next/server"

import {
  activePolls,
  failedPolls,
  getLastStateChangeAt,
  pollSingleOlt,
  successfulPolls,
} from "@/lib/olt-poller"
import type { Olt } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestedOlt = (await request.json()) as Olt
  const result = await pollSingleOlt(requestedOlt)

  if (result.alreadyActive) {
    return NextResponse.json(
      {
        ok: false,
        message: result.message,
        onus: [],
      },
      { status: 409 },
    )
  }

  return NextResponse.json(result, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    activePolls: Array.from(activePolls),
    failedPolls: Array.from(failedPolls.values()),
    successfulPolls: Array.from(successfulPolls.values()),
    lastStateChangeAt: getLastStateChangeAt(),
  })
}
