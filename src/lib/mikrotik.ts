import crypto from "node:crypto"
import net from "node:net"

export type MikrotikRouterConfig = {
  name: string
  host: string
  port: number
  username: string
  password: string
}

export type ResolvedPppSecret = {
  secretName: string
  routerName: string
  mac: string // normalized 12-char uppercase hex ("" if none)
  rawMac: string // formatted AA:BB:CC:DD:EE:FF
  macSource: "active" | "last-caller" | "none"
  lastLoggedOut?: string
  address?: string
  uptime?: string
  profile?: string
}

export type MikrotikRouterSummary = {
  name: string
  host: string
  port: number
  ok: boolean
  secretCount: number
  activeCount: number
  error?: string
}

export function getConfiguredRouters(): MikrotikRouterConfig[] {
  const defaults: MikrotikRouterConfig[] = [
    {
      name: process.env.POP1_CORE_NAME || "CALM-E1-OFC",
      host: process.env.POP1_CORE_HOST || "115.84.175.4",
      port: Number(process.env.POP1_CORE_PORT || 14917),
      username: process.env.POP1_CORE_USERNAME || "mirza",
      password: process.env.POP1_CORE_PASSWORD || "apple20",
    },
    {
      name: process.env.POP2_CORE_NAME || "CALM-E2-OFC",
      host: process.env.POP2_CORE_HOST || "115.84.175.2",
      port: Number(process.env.POP2_CORE_PORT || 11730),
      username: process.env.POP2_CORE_USERNAME || "mirza",
      password: process.env.POP2_CORE_PASSWORD || "apple20",
    },
    {
      name: process.env.POP3_CORE_NAME || "CALM-E3-OFC",
      host: process.env.POP3_CORE_HOST || "160.191.173.2",
      port: Number(process.env.POP3_CORE_PORT || 4918),
      username: process.env.POP3_CORE_USERNAME || "mirza",
      password: process.env.POP3_CORE_PASSWORD || "apple20",
    },
    {
      name: process.env.POP4_CORE_NAME || "CALM-E4-SRH",
      host: process.env.POP4_CORE_HOST || "160.191.173.5",
      port: Number(process.env.POP4_CORE_PORT || 3369),
      username: process.env.POP4_CORE_USERNAME || "mirza",
      password: process.env.POP4_CORE_PASSWORD || "apple20",
    },
  ]

  return defaults.filter((r) => Boolean(r.host && r.port && r.username))
}

export function normalizeMacHex(mac: string | null | undefined): string {
  if (!mac) return ""
  const hex = mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
  return hex.length === 12 ? hex : ""
}

export function formatColonMac(hex12: string): string {
  const clean = normalizeMacHex(hex12)
  if (!clean) return ""
  return clean.match(/.{1,2}/g)?.join(":") ?? clean
}

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len])
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff])
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff])
  if (len < 0x10000000) {
    return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
  }
  return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
}

function encodeSentence(words: string[]): Buffer {
  const bufs: Buffer[] = []
  for (const w of words) {
    const wb = Buffer.from(w, "utf8")
    bufs.push(encodeLength(wb.length), wb)
  }
  bufs.push(Buffer.from([0]))
  return Buffer.concat(bufs)
}

class RosApiClient {
  private sock: net.Socket | null = null
  private buf: Buffer = Buffer.alloc(0)

  constructor(private config: MikrotikRouterConfig) {}

  connect(timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(
        { host: this.config.host, port: this.config.port, timeout: timeoutMs },
        () => resolve()
      )
      this.sock = sock
      sock.on("error", reject)
      sock.on("timeout", () => {
        sock.destroy()
        reject(new Error(`Connection timeout (${this.config.host}:${this.config.port})`))
      })
    })
  }

  sendCommand(words: string[]): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const sock = this.sock
      if (!sock) {
        reject(new Error("Socket not connected"))
        return
      }

      const sentences: string[][] = []
      let currentWords: string[] = []

      const onData = (chunk: Buffer) => {
        this.buf = Buffer.concat([this.buf, chunk])
        while (this.buf.length > 0) {
          let offset = 0
          let len = this.buf[0]
          if ((len & 0x80) === 0x00) {
            offset = 1
          } else if ((len & 0xc0) === 0x80) {
            if (this.buf.length < 2) break
            len = ((len & ~0xc0) << 8) + this.buf[1]
            offset = 2
          } else if ((len & 0xe0) === 0xc0) {
            if (this.buf.length < 3) break
            len = ((len & ~0xe0) << 16) + (this.buf[1] << 8) + this.buf[2]
            offset = 3
          } else if ((len & 0xf0) === 0xe0) {
            if (this.buf.length < 4) break
            len = ((len & ~0xf0) << 24) + (this.buf[1] << 16) + (this.buf[2] << 8) + this.buf[3]
            offset = 4
          } else if ((len & 0xf8) === 0xf0) {
            if (this.buf.length < 5) break
            len = (this.buf[1] << 24) + (this.buf[2] << 16) + (this.buf[3] << 8) + this.buf[4]
            offset = 5
          }

          if (this.buf.length < offset + len) break
          const word = this.buf.subarray(offset, offset + len).toString("utf8")
          this.buf = this.buf.subarray(offset + len)

          if (len === 0) {
            if (currentWords.length > 0) {
              sentences.push(currentWords)
              const replyType = currentWords[0]
              currentWords = []
              if (replyType === "!done" || replyType === "!fatal") {
                cleanup()
                resolve(sentences)
                return
              }
            }
          } else {
            currentWords.push(word)
          }
        }
      }

      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }

      const cleanup = () => {
        sock.removeListener("data", onData)
        sock.removeListener("error", onError)
      }

      sock.on("data", onData)
      sock.on("error", onError)
      sock.write(encodeSentence(words))
    })
  }

  parseSentences(sentences: string[][]): Record<string, string>[] {
    const items: Record<string, string>[] = []
    for (const s of sentences) {
      if (s[0] === "!re") {
        const obj: Record<string, string> = {}
        for (let i = 1; i < s.length; i++) {
          const w = s[i]
          if (w.startsWith("=")) {
            const idx = w.indexOf("=", 1)
            if (idx !== -1) {
              obj[w.slice(1, idx)] = w.slice(idx + 1)
            }
          }
        }
        items.push(obj)
      } else if (s[0] === "!trap") {
        throw new Error(`RouterOS trap: ${s.join(" ")}`)
      }
    }
    return items
  }

  async login(): Promise<void> {
    const res = await this.sendCommand([
      "/login",
      `=name=${this.config.username}`,
      `=password=${this.config.password}`,
    ])
    const done = res.find((s) => s[0] === "!done") || []
    const retWord = done.find((w) => w.startsWith("=ret="))
    if (retWord) {
      const challenge = Buffer.from(retWord.slice(5), "hex")
      const md5 = crypto.createHash("md5")
      md5.update(Buffer.from([0]))
      md5.update(Buffer.from(this.config.password, "utf8"))
      md5.update(challenge)
      await this.sendCommand([
        "/login",
        `=name=${this.config.username}`,
        `=response=00${md5.digest("hex")}`,
      ])
    }
  }

  close(): void {
    if (this.sock) {
      this.sock.destroy()
      this.sock = null
    }
  }
}

export async function collectAndResolveMikrotikSecrets(): Promise<{
  routers: MikrotikRouterSummary[]
  resolvedByExactName: Map<string, ResolvedPppSecret>
  resolvedByLowerName: Map<string, ResolvedPppSecret>
}> {
  const configs = getConfiguredRouters()

  type ActiveEntry = {
    routerName: string
    mac: string
    address?: string
    uptime?: string
  }

  type SecretEntry = {
    routerName: string
    mac: string
    lastLoggedOut: string
    disabled: boolean
    profile?: string
  }

  const activeBySecret = new Map<string, ActiveEntry[]>()
  const secretsByName = new Map<string, SecretEntry[]>()

  const routerResults = await Promise.all(
    configs.map(async (cfg): Promise<{
      summary: MikrotikRouterSummary
      secrets: Record<string, string>[]
      active: Record<string, string>[]
    }> => {
      const client = new RosApiClient(cfg)
      try {
        await client.connect()
        await client.login()
        const secretsRaw = await client.sendCommand([
          "/ppp/secret/print",
          "=.proplist=name,caller-id,last-caller-id,last-logged-out,disabled,profile",
        ])
        const secrets = client.parseSentences(secretsRaw)

        const activeRaw = await client.sendCommand([
          "/ppp/active/print",
          "=.proplist=name,caller-id,address,uptime",
        ])
        const active = client.parseSentences(activeRaw)

        return {
          summary: {
            name: cfg.name,
            host: cfg.host,
            port: cfg.port,
            ok: true,
            secretCount: secrets.length,
            activeCount: active.length,
          },
          secrets,
          active,
        }
      } catch (err) {
        return {
          summary: {
            name: cfg.name,
            host: cfg.host,
            port: cfg.port,
            ok: false,
            secretCount: 0,
            activeCount: 0,
            error: err instanceof Error ? err.message : String(err),
          },
          secrets: [],
          active: [],
        }
      } finally {
        client.close()
      }
    })
  )

  for (const res of routerResults) {
    if (!res.summary.ok) continue
    const routerName = res.summary.name

    for (const a of res.active) {
      const name = (a.name || "").trim()
      if (!name) continue
      if (!activeBySecret.has(name)) activeBySecret.set(name, [])
      activeBySecret.get(name)!.push({
        routerName,
        mac: normalizeMacHex(a["caller-id"]),
        address: a.address,
        uptime: a.uptime,
      })
    }

    for (const s of res.secrets) {
      const name = (s.name || "").trim()
      if (!name) continue
      if (!secretsByName.has(name)) secretsByName.set(name, [])
      secretsByName.get(name)!.push({
        routerName,
        mac: normalizeMacHex(s["last-caller-id"] || s["caller-id"]),
        lastLoggedOut: s["last-logged-out"] || "",
        disabled: s.disabled === "true",
        profile: s.profile,
      })
    }
  }

  // Ensure any active secret not listed in /ppp/secret is also included
  for (const [name, actList] of activeBySecret.entries()) {
    if (!secretsByName.has(name)) {
      secretsByName.set(
        name,
        actList.map((a) => ({
          routerName: a.routerName,
          mac: a.mac,
          lastLoggedOut: "",
          disabled: false,
        }))
      )
    }
  }

  const resolvedByExactName = new Map<string, ResolvedPppSecret>()
  const resolvedByLowerName = new Map<string, ResolvedPppSecret>()

  for (const [secretName, sList] of secretsByName.entries()) {
    const actList = activeBySecret.get(secretName) || []
    const validAct = actList.find((a) => Boolean(a.mac))

    let resolved: ResolvedPppSecret
    if (validAct) {
      resolved = {
        secretName,
        routerName: validAct.routerName,
        mac: validAct.mac,
        rawMac: formatColonMac(validAct.mac),
        macSource: "active",
        address: validAct.address,
        uptime: validAct.uptime,
      }
    } else {
      const withMac = sList
        .filter((s) => Boolean(s.mac) && s.lastLoggedOut !== "1970-01-01 00:00:00")
        .sort((a, b) => b.lastLoggedOut.localeCompare(a.lastLoggedOut))

      const fallbackMac = withMac[0] ?? sList.find((s) => Boolean(s.mac))
      if (fallbackMac) {
        resolved = {
          secretName,
          routerName: fallbackMac.routerName,
          mac: fallbackMac.mac,
          rawMac: formatColonMac(fallbackMac.mac),
          macSource: "last-caller",
          lastLoggedOut: fallbackMac.lastLoggedOut || undefined,
          profile: fallbackMac.profile,
        }
      } else {
        const enabledEntry = sList.find((s) => !s.disabled) ?? sList[0]
        resolved = {
          secretName,
          routerName: enabledEntry.routerName,
          mac: "",
          rawMac: "",
          macSource: "none",
          lastLoggedOut: enabledEntry.lastLoggedOut || undefined,
          profile: enabledEntry.profile,
        }
      }
    }

    resolvedByExactName.set(secretName, resolved)
    resolvedByLowerName.set(secretName.toLowerCase(), resolved)
  }

  return {
    routers: routerResults.map((r) => r.summary),
    resolvedByExactName,
    resolvedByLowerName,
  }
}
