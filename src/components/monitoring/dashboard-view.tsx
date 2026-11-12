"use client";

import {
  CheckCircle2,
  CircleAlert,
  Database,
  RefreshCcw,
  Router,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Alert, Olt } from "@/lib/types";
import { EmptyState, InfoTile } from "./ui-primitives";
import {
  panelClass,
  tableShellClass,
  type FailedPollInfo,
  type SuccessfulPollInfo,
} from "./workspace-types";
import {
  displayDeviceType,
  displayLocation,
  oltAccent,
} from "./workspace-utils";

export function DashboardView({
  olts,
  alerts,
  notice,
  activePollingIds,
  failedPolls,
  successfulPolls,
}: {
  olts: Olt[];
  alerts: Alert[];
  notice: string;
  activePollingIds: string[];
  failedPolls: Record<string, FailedPollInfo>;
  successfulPolls: Record<string, SuccessfulPollInfo>;
}) {
  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className={panelClass}>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
            <Database className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="text-sm font-semibold text-slate-950">Status Awal</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">{notice}</p>
        {olts.length === 0 ? (
          <EmptyState
            title="Belum ada OLT"
            text="Masuk ke menu OLT untuk menambahkan perangkat."
          />
        ) : (
          <div className={tableShellClass}>
            {olts.map((olt) => (
              <OltSummary
                key={olt.id}
                olt={olt}
                isPolling={activePollingIds.includes(olt.id)}
                failedPoll={failedPolls[olt.id]}
                successPoll={successfulPolls[olt.id]}
              />
            ))}
          </div>
        )}
      </div>

      <div className={panelClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950">
            Alert Terbaru
          </h2>
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            {alerts.length}
          </span>
        </div>
        {alerts.length === 0 ? (
          <EmptyState
            title="Belum ada alert"
            text="Semua perangkat dalam kondisi aman berdasarkan data polling terakhir."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-slate-200 bg-white/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-950">
                    {alert.title}
                  </p>
                  <StatusBadge value={alert.severity} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{alert.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function OltSummary({
  olt,
  isPolling,
  failedPoll,
  successPoll,
}: {
  olt: Olt;
  isPolling?: boolean;
  failedPoll?: FailedPollInfo;
  successPoll?: SuccessfulPollInfo;
}) {
  const accent = oltAccent(olt);

  return (
    <div className="border-b border-slate-200 px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-lg ${accent.icon}`}
          >
            <Router className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">{olt.name}</p>
            <p className={`text-xs font-semibold ${accent.label}`}>
              {olt.vendor}
            </p>
            <p className="text-xs text-slate-500">
              {olt.ipAddress}:{olt.snmpPort}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isPolling && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 animate-pulse">
              <RefreshCcw
                className="h-3 w-3 animate-spin text-cyan-500"
                aria-hidden="true"
              />
              Polling SNMP...
            </span>
          )}
          {!isPolling && failedPoll && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:border-red-700 dark:bg-red-950/70 dark:text-red-200"
              title={`${failedPoll.message} (${failedPoll.failedAt})`}
            >
              <CircleAlert
                className="h-3 w-3 text-red-600"
                aria-hidden="true"
              />
              Polling Gagal
            </span>
          )}
          {!isPolling && !failedPoll && successPoll && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200"
              title={`Polling berhasil pada ${successPoll.polledAt}`}
            >
              <CheckCircle2
                className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Poll OK • {successPoll.polledAt}
            </span>
          )}
          <StatusBadge value={olt.status} />
        </div>
      </div>
      {!isPolling && failedPoll && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200">
          <CircleAlert
            className="h-3.5 w-3.5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <span className="truncate">
            <strong>Gagal Poll:</strong> {failedPoll.message} (
            {failedPoll.failedAt})
          </span>
        </div>
      )}
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <InfoTile
          label="Tipe Perangkat"
          value={displayDeviceType(olt)}
          tone={accent.tile}
        />
        <InfoTile
          label="Lokasi"
          value={displayLocation(olt)}
          tone={accent.tile}
        />
        <InfoTile
          label="ONU Online"
          value={String(olt.activeOnu)}
          tone={accent.tile}
        />
      </dl>
    </div>
  );
}
