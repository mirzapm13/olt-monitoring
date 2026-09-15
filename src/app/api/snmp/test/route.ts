import { NextResponse } from "next/server"

import { testSnmpConnection } from "@/lib/snmp"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.json()
  const result = await testSnmpConnection(body)

  return NextResponse.json(result)
}
