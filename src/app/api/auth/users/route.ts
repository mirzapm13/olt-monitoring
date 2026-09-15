import { NextResponse } from "next/server"

import { createUser, deleteUser, listAuthData, updateUser } from "@/lib/auth-server"
import type { AppRole } from "@/lib/auth-types"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(await listAuthData())
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username: string; name: string; password: string; role: AppRole; actor: string }
  const result = await createUser(body)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { id: string; username: string; name: string; role: AppRole; password?: string; actor: string }
  const result = await updateUser(body)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id: string; actor: string }
  const result = await deleteUser(body)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
