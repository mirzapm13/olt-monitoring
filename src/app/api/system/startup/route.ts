import { NextResponse } from "next/server"

import { disableStartup, enableStartup, getStartupStatus } from "@/lib/startup-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    return NextResponse.json(await getStartupStatus())
  } catch (error) {
    return NextResponse.json(
      {
        enabled: false,
        message: error instanceof Error ? error.message : "Status startup belum bisa dibaca.",
      },
      { status: 400 },
    )
  }
}

export async function POST() {
  try {
    const status = await enableStartup()

    return NextResponse.json({
      ...status,
      message: "Startup otomatis berhasil diaktifkan.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        enabled: false,
        message: error instanceof Error ? error.message : "Startup otomatis gagal diaktifkan.",
      },
      { status: 400 },
    )
  }
}

export async function DELETE() {
  try {
    const status = await disableStartup()

    return NextResponse.json({
      ...status,
      message: "Startup otomatis berhasil dinonaktifkan.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        enabled: false,
        message: error instanceof Error ? error.message : "Startup otomatis gagal dinonaktifkan.",
      },
      { status: 400 },
    )
  }
}
