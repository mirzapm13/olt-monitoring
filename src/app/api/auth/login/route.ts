import { NextResponse } from "next/server"

import { authenticateUser } from "@/lib/auth-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string }
  const session = await authenticateUser(body.username ?? "", body.password ?? "")

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        message: "Username atau password salah.",
      },
      { status: 401 },
    )
  }

  return NextResponse.json({
    ok: true,
    message: "Login berhasil.",
    session,
  })
}
