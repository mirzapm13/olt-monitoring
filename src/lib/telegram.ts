import type { MonitoringState, Olt, Onu, TelegramSettings } from "@/lib/types"

type TelegramUpdate = {
  update_id: number
  message?: {
    from?: {
      is_bot?: boolean
    }
    chat: {
      id: number | string
    }
    text?: string
  }
}

type TelegramApiResponse<T> = {
  ok: boolean
  result?: T
  description?: string
}

const telegramTimeoutMs = 8000
const telegramBrand = "Mikroin Monitor"
let telegramPollingBusy = false

function hasTelegramCredentials(settings: TelegramSettings) {
  return Boolean(settings.botToken.trim() && settings.chatId.trim())
}

function hasTelegramConfig(settings: TelegramSettings) {
  return Boolean(settings.enabled && hasTelegramCredentials(settings))
}

function telegramApiUrl(settings: TelegramSettings, method: string) {
  return `https://api.telegram.org/bot${settings.botToken.trim()}/${method}`
}

function withTelegramBrand(text: string) {
  const cleanText = text.trim()
  if (cleanText.toLowerCase().startsWith(telegramBrand.toLowerCase())) return cleanText

  return `${telegramBrand}\n\n${cleanText}`
}

async function fetchTelegram(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), telegramTimeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function formatRxPower(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-"
  return `${value} dBm`
}

function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-"
  return `${value} C`
}

function onuLine(onu: Onu, olt: Olt | undefined) {
  return [
    `Nama: ${onu.name}`,
    `OLT: ${olt?.name ?? "-"}`,
    `PON: ${onu.ponPort}:${onu.onuIndex}`,
    `Serial: ${onu.serialNumber}`,
    `Status: ${onu.status}`,
    `RX: ${formatRxPower(onu.rxPower)}`,
    `Suhu: ${formatTemperature(onu.temperatureC)}`,
    `Kasus Down: ${onu.status === "online" ? "-" : onu.downReason || "Down"}`,
    `Last Seen: ${onu.lastSeen}`,
  ].join("\n")
}

export async function sendTelegramMessage(settings: TelegramSettings, text: string, chatId = settings.chatId, requireEnabled = true) {
  if ((requireEnabled && !settings.enabled) || !hasTelegramCredentials(settings)) {
    return {
      ok: false,
      message: requireEnabled ? "Telegram belum aktif atau Bot Token/Chat ID belum lengkap." : "Bot Token dan Chat ID wajib diisi.",
    }
  }

  try {
    const response = await fetchTelegram(telegramApiUrl(settings, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: withTelegramBrand(text),
        disable_web_page_preview: true,
      }),
    })
    const result = (await response.json()) as TelegramApiResponse<unknown>

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        message: result.description || "Telegram gagal mengirim pesan.",
      }
    }

    return {
      ok: true,
      message: "Telegram berhasil mengirim pesan.",
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Telegram gagal dihubungi: ${error.message}` : "Telegram gagal dihubungi.",
    }
  }
}

export async function sendTelegramTest(settings: TelegramSettings) {
  return sendTelegramMessage(settings, "Test Telegram Mikroin Monitor berhasil.", settings.chatId, false)
}

function latestSavedOnuEvent(state: MonitoringState, onuId: string) {
  const latest = state.alerts.find((alert) => alert.id.startsWith(`onu-${onuId}-down-`) || alert.id.startsWith(`onu-${onuId}-recovery-`))
  if (!latest) return null
  if (latest.id.startsWith(`onu-${onuId}-down-`)) return "down"
  if (latest.id.startsWith(`onu-${onuId}-recovery-`)) return "recovery"
  return null
}

function latestSavedOltEvent(state: MonitoringState, oltId: string) {
  const latest = state.alerts.find((alert) => alert.id.startsWith(`olt-${oltId}-down-`) || alert.id.startsWith(`olt-${oltId}-recovery-`))
  if (!latest) return null
  if (latest.id.startsWith(`olt-${oltId}-down-`)) return "down"
  if (latest.id.startsWith(`olt-${oltId}-recovery-`)) return "recovery"
  return null
}

function oltLine(olt: Olt, status: "down" | "recovery", errorMessage?: string) {
  return [
    status === "down" ? "OLT DOWN" : "OLT RECOVERY",
    "",
    `Nama: ${olt.name}`,
    `IP: ${olt.ipAddress}:${olt.snmpPort || 161}`,
    `Vendor: ${olt.vendor}`,
    `Tipe: ${olt.model || "-"}`,
    `Lokasi: ${olt.location || "-"}`,
    `Status: ${status === "down" ? "offline" : "online"}`,
    errorMessage ? `Error: ${errorMessage}` : null,
    `Waktu: ${new Date().toLocaleString("id-ID")}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function notifyOltStatusChange(state: MonitoringState, olt: Olt, status: "down" | "recovery", errorMessage?: string) {
  const settings = state.settings.telegram
  const result = {
    sent: 0,
    failed: 0,
    skipped: false,
    message: "Tidak ada perubahan status OLT.",
  }

  if (!hasTelegramConfig(settings)) {
    return {
      ...result,
      skipped: true,
      message: "Telegram belum aktif atau Bot Token/Chat ID belum lengkap.",
    }
  }

  if (latestSavedOltEvent(state, olt.id) === status) {
    return {
      ...result,
      skipped: true,
      message: `Notifikasi OLT ${status === "down" ? "down" : "recovery"} sudah pernah dikirim untuk event terakhir.`,
    }
  }

  const notification = await sendTelegramMessage(settings, oltLine(olt, status, errorMessage))

  if (notification.ok) {
    return {
      ...result,
      sent: 1,
      message: "Telegram OLT berhasil dikirim.",
    }
  }

  return {
    ...result,
    failed: 1,
    message: notification.message,
  }
}

export async function notifyOnuStatusChanges(state: MonitoringState, olt: Olt, nextOnus: Onu[]) {
  const settings = state.settings.telegram
  const result = {
    checked: nextOnus.length,
    downDetected: 0,
    recoveryDetected: 0,
    sent: 0,
    failed: 0,
    skipped: false,
    message: "Tidak ada perubahan status ONT.",
  }

  if (!hasTelegramConfig(settings)) {
    return {
      ...result,
      skipped: true,
      message: "Telegram belum aktif atau Bot Token/Chat ID belum lengkap.",
    }
  }

  const previousById = new Map(state.onus.filter((onu) => onu.oltId === olt.id).map((onu) => [onu.id, onu]))

  for (const onu of nextOnus) {
    const previous = previousById.get(onu.id)
    if (!previous) continue

    const wasOnline = previous.status === "online"
    const isOnline = onu.status === "online"

    if (settings.notifyOntDown && wasOnline && !isOnline) {
      if (latestSavedOnuEvent(state, onu.id) === "down") continue

      result.downDetected += 1
      const notification = await sendTelegramMessage(
        settings,
        [
          "ONT DOWN",
          "",
          `OLT: ${olt.name}`,
          `Nama: ${onu.name}`,
          `Serial: ${onu.serialNumber}`,
          `PON: ${onu.ponPort}:${onu.onuIndex}`,
          `Status: ${onu.status}`,
          `RX: ${formatRxPower(onu.rxPower)}`,
          `Suhu: ${formatTemperature(onu.temperatureC)}`,
          `Kasus: ${onu.downReason || "Down"}`,
          `Waktu: ${new Date().toLocaleString("id-ID")}`,
        ].join("\n"),
      )
      if (notification.ok) result.sent += 1
      else result.failed += 1
      continue
    }

    if (settings.notifyRecovery && !wasOnline && isOnline) {
      if (latestSavedOnuEvent(state, onu.id) === "recovery") continue

      result.recoveryDetected += 1
      const notification = await sendTelegramMessage(
        settings,
        [
          "ONT RECOVERY",
          "",
          `OLT: ${olt.name}`,
          `Nama: ${onu.name}`,
          `Serial: ${onu.serialNumber}`,
          `PON: ${onu.ponPort}:${onu.onuIndex}`,
          `Status: online`,
          `RX: ${formatRxPower(onu.rxPower)}`,
          `Suhu: ${formatTemperature(onu.temperatureC)}`,
          `Waktu: ${new Date().toLocaleString("id-ID")}`,
        ].join("\n"),
      )
      if (notification.ok) result.sent += 1
      else result.failed += 1
    }
  }

  if (result.sent > 0 || result.failed > 0) {
    return {
      ...result,
      message: `Telegram: ${result.sent} terkirim, ${result.failed} gagal.`,
    }
  }

  if (result.downDetected > 0 || result.recoveryDetected > 0) {
    return {
      ...result,
      message: "Ada perubahan status ONT, tetapi notifikasi terkait sedang nonaktif.",
    }
  }

  return result
}

function buildMenuText() {
  return [
    "Menu Mikroin Monitor",
    "",
    "/cek nama_pelanggan",
    "Cari ONT berdasarkan nama, serial, atau PON.",
    "",
    "/down",
    "Lihat daftar ONT yang sedang down.",
    "",
    "/olt",
    "Lihat status OLT.",
    "",
    "/summary",
    "Lihat ringkasan jaringan.",
  ].join("\n")
}

function buildSummaryText(state: MonitoringState) {
  const totalOnu = state.onus.length
  const onlineOnu = state.onus.filter((onu) => onu.status === "online").length
  const downOnu = totalOnu - onlineOnu
  const onlineOlt = state.olts.filter((olt) => olt.status === "online").length

  return [
    "Summary Mikroin Monitor",
    "",
    `OLT online: ${onlineOlt}/${state.olts.length}`,
    `Total ONU: ${totalOnu}`,
    `ONU online: ${onlineOnu}`,
    `ONU down: ${downOnu}`,
  ].join("\n")
}

function buildOltText(state: MonitoringState) {
  if (state.olts.length === 0) return "Belum ada OLT."

  return [
    "Status OLT",
    "",
    ...state.olts.map((olt, index) =>
      [
        `${index + 1}. ${olt.name}`,
        `   IP: ${olt.ipAddress}:${olt.snmpPort}`,
        `   Status: ${olt.status}`,
        `   ONU online: ${olt.activeOnu}`,
        `   Last seen: ${olt.lastSeen}`,
      ].join("\n"),
    ),
  ].join("\n")
}

function buildDownText(state: MonitoringState) {
  const downOnus = state.onus.filter((onu) => onu.status !== "online").slice(0, 20)
  if (downOnus.length === 0) return "Tidak ada ONT down berdasarkan data terakhir."

  return [
    `ONT down (${downOnus.length} pertama)`,
    "",
    ...downOnus.map((onu, index) => {
      const olt = state.olts.find((item) => item.id === onu.oltId)
      return `${index + 1}. ${onu.name} | ${olt?.name ?? "-"} | PON ${onu.ponPort}:${onu.onuIndex} | ${onu.downReason || "Down"}`
    }),
  ].join("\n")
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./-]+/g, " ")
    .replace(/[^\p{L}\p{N}:]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getOnuSearchScore(onu: Onu, olt: Olt | undefined, keyword: string) {
  const name = normalizeSearchValue(onu.name)
  const serial = normalizeSearchValue(onu.serialNumber)
  const pon = normalizeSearchValue(`${onu.ponPort}:${onu.onuIndex}`)
  const oltName = normalizeSearchValue(olt?.name ?? "")
  const haystack = `${name} ${serial} ${pon} ${oltName}`
  const keywordParts = keyword.split(" ").filter(Boolean)

  if (name === keyword) return 1000
  if (serial === keyword) return 950
  if (pon === keyword) return 900
  if (name.startsWith(keyword)) return 850
  if (name.split(" ").some((part) => part.startsWith(keyword))) return 760
  if (keywordParts.length > 1 && keywordParts.every((part) => name.includes(part))) return 700
  if (name.includes(keyword)) return 620
  if (serial.includes(keyword)) return 560
  if (pon.includes(keyword)) return 520
  if (oltName.includes(keyword)) return 420
  if (keywordParts.every((part) => haystack.includes(part))) return 320

  return 0
}

function buildCekText(state: MonitoringState, query: string) {
  const normalizedKeyword = normalizeSearchValue(query)
  if (!normalizedKeyword) return "Format: /cek nama_pelanggan"

  const rankedMatches = state.onus
    .map((onu) => {
      const olt = state.olts.find((item) => item.id === onu.oltId)
      return {
        onu,
        olt,
        score: getOnuSearchScore(onu, olt, normalizedKeyword),
      }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.onu.name.length - right.onu.name.length
    })
  const matches = rankedMatches.slice(0, 5)

  if (rankedMatches.length === 0) {
    const examples = state.onus
      .slice(0, 5)
      .map((onu) => onu.name)
      .filter(Boolean)

    return [
      `Data pelanggan "${query}" tidak ditemukan di database bot.`,
      "",
      `Database bot saat ini berisi ${state.onus.length} ONU/ONT dari ${state.olts.length} OLT.`,
      examples.length > 0 ? `Contoh nama yang terbaca: ${examples.join(", ")}.` : "Belum ada contoh nama ONU/ONT yang terbaca.",
      "Jika data ada di UI tetapi bot tidak menemukannya, restart service Mikroin Monitor agar worker bot membaca database terbaru.",
    ].join("\n")
  }

  if (matches.length === 1) {
    const { olt, onu } = matches[0]
    return ["Hasil pencarian ONT", "", onuLine(onu, olt)].join("\n")
  }

  return [
    `Ditemukan ${rankedMatches.length} data untuk "${normalizedKeyword}"`,
    rankedMatches.length > matches.length ? `Menampilkan ${matches.length} data paling cocok.` : "",
    "",
    ...matches.map(({ olt, onu }, index) => [`${index + 1}.`, onuLine(onu, olt)].join("\n")),
  ]
    .filter(Boolean)
    .join("\n\n")
}

function handleBotCommand(state: MonitoringState, text: string) {
  const [rawCommand, ...rest] = text.trim().split(/\s+/)
  const command = rawCommand.split("@")[0].toLowerCase()
  const argument = rest.join(" ")

  if (command === "/menu" || command === "/start") return buildMenuText()
  if (command === "/cek" || command === "/cari") return buildCekText(state, argument)
  if (command === "/down") return buildDownText(state)
  if (command === "/olt") return buildOltText(state)
  if (command === "/summary") return buildSummaryText(state)

  return "Perintah tidak dikenal. Ketik /menu untuk melihat daftar perintah."
}

export async function processTelegramUpdates(state: MonitoringState) {
  if (telegramPollingBusy) {
    return {
      state,
      processed: 0,
      message: "Telegram bot polling sedang berjalan.",
    }
  }

  telegramPollingBusy = true
  const settings = state.settings.telegram
  try {
    if (!hasTelegramConfig(settings) || !settings.botPollingEnabled) {
      return {
        state,
        processed: 0,
        message: "Telegram bot polling belum aktif.",
      }
    }

    const offset = settings.lastUpdateId > 0 ? settings.lastUpdateId + 1 : undefined
    const params = new URLSearchParams({ timeout: "0", allowed_updates: JSON.stringify(["message"]) })
    if (offset) params.set("offset", String(offset))

    let response: Response
    let result: TelegramApiResponse<TelegramUpdate[]>

    try {
      response = await fetchTelegram(`${telegramApiUrl(settings, "getUpdates")}?${params.toString()}`)
      result = (await response.json()) as TelegramApiResponse<TelegramUpdate[]>
    } catch (error) {
      return {
        state,
        processed: 0,
        message: error instanceof Error ? `Telegram bot polling gagal: ${error.message}` : "Telegram bot polling gagal dihubungi.",
      }
    }

    if (!response.ok || !result.ok || !Array.isArray(result.result)) {
      return {
        state,
        processed: 0,
        message: result.description || "Gagal membaca update Telegram.",
      }
    }

    let lastUpdateId = settings.lastUpdateId
    let processed = 0

    for (const update of result.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id)
      const text = update.message?.text?.trim()
      const chatId = String(update.message?.chat.id ?? "")
      const isBotMessage = Boolean(update.message?.from?.is_bot)

      if (!text || !text.startsWith("/") || isBotMessage || !chatId || chatId !== settings.chatId.trim()) continue

      await sendTelegramMessage(settings, handleBotCommand(state, text), chatId)
      processed += 1
    }

    return {
      state: {
        ...state,
        settings: {
          ...state.settings,
          telegram: {
            ...settings,
            lastUpdateId,
          },
        },
      },
      processed,
      message: processed > 0 ? `Memproses ${processed} pesan Telegram.` : "Tidak ada pesan Telegram baru.",
    }
  } finally {
    telegramPollingBusy = false
  }
}
