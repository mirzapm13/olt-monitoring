"use client"

import { LockKeyhole, Network, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { authStorageKey, type AuthSession } from "@/lib/auth-types"

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("Masuk untuk membuka dashboard monitoring.")

  useEffect(() => {
    if (window.localStorage.getItem(authStorageKey)) router.replace("/")
  }, [router])

  async function login() {
    setLoading(true)
    setMessage("Memeriksa akses...")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const result = (await response.json()) as { ok: boolean; message: string; session?: AuthSession }

      if (!result.ok || !result.session) {
        setMessage(result.message)
        return
      }

      window.localStorage.setItem(authStorageKey, JSON.stringify(result.session))
      window.dispatchEvent(new Event("mikroin-auth-change"))
      setMessage("Login berhasil. Membuka dashboard...")
      router.replace("/")
    } catch {
      setMessage("Login belum bisa diproses. Cek server lokal.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--app-bg)] text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl" />
      </div>
      <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_430px]">
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-cyan-200/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:bg-white/10">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950">
              <Network className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-950">Mikroin Monitor</p>
              <p className="text-xs text-slate-500">OLT Operations Center</p>
            </div>
          </div>
          <h1 className="mt-8 max-w-2xl text-5xl font-black tracking-tight text-slate-950">
            Pantau OLT, ONT, dan alert jaringan dari satu ruang kontrol.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Login menjaga akses operasional tetap aman, rapi, dan hanya dapat digunakan oleh pengguna yang memiliki akun.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-2xl shadow-cyan-950/10 backdrop-blur dark:bg-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Login</p>
              <p className="mt-1 text-xs text-slate-500">Masukkan akun Mikroin Monitor.</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Username</span>
              <input
                className="mt-1 h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Password</span>
              <input
                className="mt-1 h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void login()
                }}
              />
            </label>
            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-700 to-sky-700 px-4 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 transition hover:from-cyan-600 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={loading || !username.trim() || !password}
              onClick={() => void login()}
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {loading ? "Memeriksa..." : "Masuk Dashboard"}
            </button>
          </div>
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm font-medium text-slate-600">{message}</p>
        </div>
      </section>
    </main>
  )
}
