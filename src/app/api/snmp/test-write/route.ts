import { NextResponse } from "next/server"

import { testOnuRenameWrite } from "@/lib/snmp"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.json()
  const result = await testOnuRenameWrite(body)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
