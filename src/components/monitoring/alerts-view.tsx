"use client";

import { CircleCheck, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Alert } from "@/lib/types";
import { EmptyState } from "./ui-primitives";
import { panelClass, secondaryButtonClass } from "./workspace-types";

export function AlertsView({
  alerts,
  savedAlerts,
  onClearAcknowledged,
  onClearAll,
}: {
  alerts: Alert[];
  savedAlerts: Alert[];
  onClearAcknowledged: () => void;
  onClearAll: () => void;
}) {
  const openCount = alerts.filter((alert) => !alert.acknowledged).length;
  const completedSavedCount = savedAlerts.filter(
    (alert) => alert.acknowledged,
  ).length;

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">Alert Aktif</h1>
          <p className="text-sm text-slate-500">
            Gangguan dibuat otomatis dari status OLT dan ONU/ONT terakhir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
            {openCount} terbuka
          </span>
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={onClearAcknowledged}
            disabled={completedSavedCount === 0}
            title={
              completedSavedCount === 0
                ? "Belum ada alert selesai yang tersimpan"
                : "Hapus alert yang sudah selesai"
            }
          >
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Bersihkan Selesai
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            onClick={onClearAll}
            disabled={savedAlerts.length === 0}
            title={
              savedAlerts.length === 0
                ? "Belum ada riwayat alert yang tersimpan"
                : "Hapus semua riwayat alert tersimpan"
            }
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Bersihkan Semua
          </button>
        </div>
      </div>
      {savedAlerts.length > 0 && (
        <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-xs leading-5 text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-950/25 dark:text-cyan-100">
          Riwayat tersimpan: {savedAlerts.length}. Alert selesai:{" "}
          {completedSavedCount}. Alert aktif dari status perangkat tetap muncul
          sampai kondisi perangkat normal.
        </div>
      )}
      {alerts.length === 0 ? (
        <EmptyState
          title="Belum ada alert"
          text="Semua perangkat dalam kondisi aman berdasarkan data polling terakhir."
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={alert.severity} />
                  <p className="text-sm font-semibold text-slate-950">
                    {alert.title}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                <p className="mt-2 text-xs text-slate-400">{alert.createdAt}</p>
              </div>
              <span className="self-start rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                {alert.acknowledged ? "Selesai" : "Terbuka"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
