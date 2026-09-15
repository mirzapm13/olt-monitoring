import { NextResponse } from "next/server"

import { renameOnuOnDevice } from "@/lib/snmp"

export async function POST(request: Request) {
  const body = await request.json()
  const result = await renameOnuOnDevice(body)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
