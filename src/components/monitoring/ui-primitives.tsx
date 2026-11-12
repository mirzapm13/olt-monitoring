"use client";

import {
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Info,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Olt } from "@/lib/types";
import {
  fieldClass,
  secondaryButtonClass,
  type ClearAlertsMode,
  type SignalTone,
  type ToastState,
} from "./workspace-types";

export function ToastNotice({
  toast,
  onClose,
}: {
  toast: NonNullable<ToastState>;
  onClose: () => void;
}) {
  const toneStyle = {
    info: {
      icon: Info,
      label: "Info",
      className: "border-cyan-200 bg-cyan-50 text-cyan-950",
      iconClassName: "bg-cyan-100 text-cyan-700",
    },
    success: {
      icon: CircleCheck,
      label: "Berhasil",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconClassName: "bg-emerald-100 text-emerald-700",
    },
    error: {
      icon: CircleAlert,
      label: "Gagal",
      className: "border-red-200 bg-red-50 text-red-950",
      iconClassName: "bg-red-100 text-red-700",
    },
  }[toast.tone];
  const Icon = toneStyle.icon;

  return (
    <div
      className={`toast-pop fixed right-4 top-20 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-lg backdrop-blur ${toneStyle.className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneStyle.iconClassName}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toneStyle.label}</p>
          <p className="mt-1 text-sm leading-5">{toast.message}</p>
        </div>
        <button
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-current/15 bg-white/50 transition hover:bg-white/80"
          type="button"
          onClick={onClose}
          aria-label="Tutup notifikasi"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function DeleteOltDialog({
  olt,
  onCancel,
  onConfirm,
}: {
  olt: Olt;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-olt-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-red-500/30 dark:bg-slate-950">
        <div className="bg-gradient-to-br from-red-50 via-white to-orange-50 p-5 dark:from-red-950/35 dark:via-slate-950 dark:to-orange-950/25">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700 shadow-sm dark:bg-red-500/15 dark:text-red-200">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p
                  id="delete-olt-title"
                  className="text-base font-bold text-slate-950 dark:text-slate-50"
                >
                  Hapus OLT ini?
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Tindakan ini akan menghapus OLT, data ONU/ONT, dan alert yang
                  terhubung dari database lokal.
                </p>
              </div>
            </div>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              type="button"
              onClick={onCancel}
              aria-label="Tutup popup hapus OLT"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white/75 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
              {olt.name}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {olt.ipAddress}:{olt.snmpPort || 161} | {olt.vendor}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Jika ingin memakai OLT ini lagi, tambahkan ulang dari menu OLT.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
            type="button"
            onClick={onConfirm}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Ya, Hapus OLT
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClearAlertsDialog({
  mode,
  savedCount,
  completedCount,
  activeCount,
  onCancel,
  onConfirm,
}: {
  mode: ClearAlertsMode;
  savedCount: number;
  completedCount: number;
  activeCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isAll = mode === "all";
  const count = isAll ? savedCount : completedCount;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-alerts-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-amber-500/30 dark:bg-slate-950">
        <div className="bg-gradient-to-br from-amber-50 via-white to-red-50 p-5 dark:from-amber-950/35 dark:via-slate-950 dark:to-red-950/25">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/15 dark:text-amber-200">
                <CircleAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p
                  id="clear-alerts-title"
                  className="text-base font-bold text-slate-950 dark:text-slate-50"
                >
                  {isAll
                    ? "Bersihkan semua riwayat alert?"
                    : "Bersihkan alert selesai?"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {isAll
                    ? "Semua riwayat alert yang tersimpan akan dihapus dari database lokal."
                    : "Hanya alert yang sudah selesai/acknowledged yang akan dihapus dari database lokal."}
                </p>
              </div>
            </div>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              type="button"
              onClick={onCancel}
              aria-label="Tutup popup bersihkan alert"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-white/75 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">
                Riwayat yang akan dibersihkan
              </span>
              <span className="font-bold text-slate-950 dark:text-slate-50">
                {count}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">
                Alert aktif di layar
              </span>
              <span className="font-bold text-red-700 dark:text-red-200">
                {activeCount}
              </span>
            </div>
            <p className="pt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Alert aktif dari status perangkat tetap akan muncul jika OLT atau
              ONU/ONT masih down, RX lemah, atau suhu tinggi.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white shadow-lg shadow-amber-900/20 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onConfirm}
            disabled={count <= 0}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isAll ? "Bersihkan Semua" : "Bersihkan Selesai"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TextInput({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="relative block">
        <input
          className={`${fieldClass} ${isPassword ? "pr-11" : ""}`}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {isPassword && (
          <button
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={
              showPassword ? "Sembunyikan password" : "Lihat password"
            }
            title={showPassword ? "Sembunyikan password" : "Lihat password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </span>
    </label>
  );
}

export function ToggleInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 p-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-5 w-5 accent-cyan-700"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SignalBadge({
  value,
  tone,
}: {
  value: string;
  tone: SignalTone;
}) {
  const styles: Record<SignalTone, string> = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-900/5",
    warning: "border-amber-200 bg-amber-50 text-amber-700 shadow-amber-900/5",
    critical: "border-red-200 bg-red-50 text-red-700 shadow-red-900/5",
    empty: "border-slate-200 bg-slate-100 text-slate-600 shadow-slate-900/5",
  };

  return (
    <span
      className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-bold shadow-sm ${styles[tone]}`}
    >
      {value}
    </span>
  );
}

function infoTileAccent(label: string) {
  const text = label.toLowerCase();

  if (text.includes("nama")) {
    return {
      strip: "from-cyan-400 via-sky-300 to-cyan-200",
      dot: "bg-cyan-500 shadow-cyan-400/50",
      label: "text-cyan-700 dark:text-cyan-300",
      value: "text-slate-900 dark:text-slate-100",
    };
  }

  if (text.includes("tipe")) {
    return {
      strip: "from-sky-400 via-blue-300 to-cyan-200",
      dot: "bg-sky-500 shadow-sky-400/50",
      label: "text-sky-700 dark:text-sky-300",
      value: "text-slate-900 dark:text-slate-100",
    };
  }

  if (text.includes("firmware")) {
    return {
      strip: "from-amber-300 via-orange-300 to-yellow-200",
      dot: "bg-amber-500 shadow-amber-400/50",
      label: "text-amber-700 dark:text-amber-300",
      value: "text-slate-900 dark:text-slate-100",
    };
  }

  if (text.includes("lokasi")) {
    return {
      strip: "from-emerald-400 via-teal-300 to-lime-200",
      dot: "bg-emerald-500 shadow-emerald-400/50",
      label: "text-emerald-700 dark:text-emerald-300",
      value: "text-slate-900 dark:text-slate-100",
    };
  }

  return {
    strip: "from-lime-300 via-emerald-300 to-cyan-200",
    dot: "bg-emerald-500 shadow-emerald-400/50",
    label: "text-emerald-700 dark:text-emerald-300",
    value: "text-slate-900 dark:text-slate-100",
  };
}

export function InfoTile({
  label,
  value,
  tone = "border-slate-200 bg-transparent dark:border-slate-700/70",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const accent = infoTileAccent(label);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 ${tone}`}
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent.strip}`}
      />
      <dt
        className={`flex items-center gap-2 text-xs font-semibold ${accent.label}`}
      >
        <span className={`h-2 w-2 rounded-full shadow-lg ${accent.dot}`} />
        {label}
      </dt>
      <dd className={`mt-2 break-words text-sm font-extrabold ${accent.value}`}>
        {value || "-"}
      </dd>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function OltHealthMetricsRow({
  cpuLoad,
  memoryLoad,
  uptime,
  temperatureC,
  className = "",
}: {
  cpuLoad: number;
  memoryLoad: number;
  uptime: string;
  temperatureC?: number | null;
  className?: string;
}) {
  const cpuVal = Number.isFinite(cpuLoad) && cpuLoad > 0 ? Math.round(cpuLoad) : null;
  const memVal = Number.isFinite(memoryLoad) && memoryLoad > 0 ? Math.round(memoryLoad) : null;
  const tempVal =
    temperatureC !== null && temperatureC !== undefined && Number.isFinite(temperatureC)
      ? Math.round(temperatureC)
      : null;

  const meterColor = (val: number | null) => {
    if (val === null) return "bg-slate-300 dark:bg-slate-700";
    if (val >= 85) return "bg-red-500";
    if (val >= 65) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const textTone = (val: number | null) => {
    if (val === null) return "text-slate-500 dark:text-slate-400";
    if (val >= 85) return "text-red-700 dark:text-red-300";
    if (val >= 65) return "text-amber-700 dark:text-amber-300";
    return "text-emerald-700 dark:text-emerald-300";
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs ${className}`}
    >
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-slate-700/80">
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          CPU
        </span>
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${meterColor(cpuVal)}`}
            style={{ width: `${cpuVal !== null ? Math.min(100, Math.max(4, cpuVal)) : 0}%` }}
          />
        </div>
        <span className={`font-extrabold ${textTone(cpuVal)}`}>
          {cpuVal !== null ? `${cpuVal}%` : "-"}
        </span>
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-slate-700/80">
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          RAM
        </span>
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${meterColor(memVal)}`}
            style={{ width: `${memVal !== null ? Math.min(100, Math.max(4, memVal)) : 0}%` }}
          />
        </div>
        <span className={`font-extrabold ${textTone(memVal)}`}>
          {memVal !== null ? `${memVal}%` : "-"}
        </span>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-slate-700/80">
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          Uptime
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {uptime || "-"}
        </span>
      </div>

      {tempVal !== null && (
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-slate-700/80">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            Suhu OLT
          </span>
          <span
            className={`font-extrabold ${
              tempVal >= 65
                ? "text-red-700 dark:text-red-300"
                : tempVal >= 55
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {tempVal} °C
          </span>
        </div>
      )}
    </div>
  );
}
