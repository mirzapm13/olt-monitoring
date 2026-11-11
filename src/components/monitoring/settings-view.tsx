"use client";

import {
  HeartHandshake,
  Info,
  Mail,
  MessageCircle,
  RefreshCcw,
} from "lucide-react";
import Image from "next/image";
import type { TelegramSettings } from "@/lib/types";
import { TextInput, ToggleInput } from "./ui-primitives";
import { cyanButtonClass, panelClass } from "./workspace-types";

export function AboutView() {
  const features = [
    "Monitoring OLT via SNMP",
    "Data ONU/ONT, RX, suhu, dan kasus down",
    "Alert down/recovery",
    "Notifikasi Telegram",
    "Role Admin dan Super Admin",
    "Chat Bot Telegram",
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className={panelClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
              About Mikroin Monitor
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Monitoring OLT dan ONU/ONT yang ringan untuk operasional jaringan.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Mikroin Monitor adalah aplikasi monitoring OLT dan ONU/ONT
              berbasis SNMP untuk membantu teknisi memantau jaringan fiber
              secara cepat, rapi, dan terpusat. Aplikasi ini menampilkan status
              OLT, daftar pelanggan ONU/ONT, power RX, suhu perangkat, alert
              gangguan, serta notifikasi Telegram ketika terjadi perubahan
              status seperti ONT down, recovery, atau OLT tidak dapat dihubungi.
              Mikroin Monitor juga dilengkapi chat bot Telegram untuk membantu
              pengecekan data pelanggan, ONT down, status OLT, dan ringkasan
              jaringan langsung dari chat.
            </p>
          </div>
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20">
            <Info className="h-7 w-7" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-sm font-bold text-cyan-900 shadow-sm dark:bg-cyan-950/20 dark:text-cyan-50"
            >
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-950">WhatsApp</p>
                <p className="text-sm font-semibold text-slate-600">
                  085353368296
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-950">Email</p>
                <p className="break-all text-sm font-semibold text-slate-600">
                  radius.mikroin@gmail.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">
                Dukungan Pengembangan
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-200">
                Bantu pengembangan fitur Mikroin Monitor.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-emerald-900 dark:text-emerald-50">
            Jika aplikasi ini membantu operasional jaringan Anda, dukungan
            donasi sangat berarti untuk pengembangan, perawatan, dan penambahan
            fitur. Untuk permintaan hak akses Super Admin atau dukungan
            lanjutan, silakan hubungi pengembang melalui WhatsApp atau email.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <Image
            className="h-auto w-full rounded-2xl"
            src="/QRIS.svg"
            alt="QRIS donasi Mikroin Monitor"
            width={720}
            height={1120}
            priority={false}
          />
        </div>
      </aside>
    </section>
  );
}

export function SettingsView({
  telegram,
  onTelegramChange,
  onTestTelegram,
}: {
  telegram: TelegramSettings;
  onTelegramChange: (settings: TelegramSettings) => void;
  onTestTelegram: (settings: TelegramSettings) => void;
}) {
  function updateTelegram<K extends keyof TelegramSettings>(
    key: K,
    value: TelegramSettings[K],
  ) {
    onTelegramChange({ ...telegram, [key]: value });
  }

  return (
    <section className={panelClass}>
      <h1 className="text-sm font-semibold text-slate-950">Setting Awal</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4">
          <p className="text-sm font-medium text-slate-950">Collector</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Collector membaca status OLT dan ONU/ONT secara berkala, lalu
            membuat alert otomatis saat terdeteksi gangguan atau perubahan
            status.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            OLT yang sudah berjalan: HSGQ GPON, HSGQ EPON, dan VSOL.
          </div>
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/25 dark:text-amber-100">
            Dukungan untuk merk dan tipe OLT lainnya masih menunggu sampel
            perangkat. Jika Anda memiliki OLT yang belum terdaftar di aplikasi
            ini, silakan hubungi pengembang agar profil OID dapat dipelajari dan
            ditambahkan.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-950">Telegram Bot</p>
              <p className="mt-1 text-sm text-slate-500">
                Notifikasi ONT down dan command chat seperti /cek, /down, /olt,
                /summary, /menu.
              </p>
            </div>
            <button
              className={cyanButtonClass}
              type="button"
              onClick={() => onTestTelegram(telegram)}
            >
              Test Telegram
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextInput
              label="Bot Token"
              value={telegram.botToken}
              onChange={(value) => updateTelegram("botToken", value)}
              placeholder="123456:ABC..."
              type="password"
            />
            <TextInput
              label="Chat ID"
              value={telegram.chatId}
              onChange={(value) => updateTelegram("chatId", value)}
              placeholder="123456789"
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ToggleInput
              label="Aktifkan Telegram"
              checked={telegram.enabled}
              onChange={(value) => updateTelegram("enabled", value)}
            />
            <ToggleInput
              label="Aktifkan chat bot polling"
              checked={telegram.botPollingEnabled}
              onChange={(value) => updateTelegram("botPollingEnabled", value)}
            />
            <ToggleInput
              label="Notifikasi ONT down"
              checked={telegram.notifyOntDown}
              onChange={(value) => updateTelegram("notifyOntDown", value)}
            />
            <ToggleInput
              label="Notifikasi ONT recovery"
              checked={telegram.notifyRecovery}
              onChange={(value) => updateTelegram("notifyRecovery", value)}
            />
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-950">Perintah bot</p>
            <p className="mt-1">
              /menu, /cek nama pelanggan, /down, /olt, /summary
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
