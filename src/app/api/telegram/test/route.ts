import { NextResponse } from "next/server"

import { sendTelegramTest } from "@/lib/telegram"
import type { TelegramSettings } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const settings = (await request.json()) as TelegramSettings
  const result = await sendTelegramTest(settings)

  return NextResponse.json(result)
}
