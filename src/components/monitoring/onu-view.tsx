"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Pencil,
  RefreshCcw,
  Router,
  Save,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Olt, Onu } from "@/lib/types";
import { EmptyState, SignalBadge } from "./ui-primitives";
import {
  panelClass,
  secondaryButtonClass,
  type FailedPollInfo,
  type SuccessfulPollInfo,
} from "./workspace-types";
import {
  formatNumber,
  formatRxPower,
  formatTemperature,
  rxTone,
  supportsSnmpRename,
  temperatureTone,
} from "./workspace-utils";

export function OnuView(props: {
  olts: Olt[];
  allOnusCount: number;
  oltFilteredCount: number;
  onus: Onu[];
  selectedOltId: string;
  selectedOlt?: Olt;
  selectedPon: string;
  availablePons: Array<{ ponPort: string; count: number }>;
  pageSize: number;
  currentPage: number;
  query: string;
  editingOnuId: string | null;
  draftName: string;
  onSelectOlt: (id: string) => void;
  onSelectPon: (pon: string) => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onQuery: (value: string) => void;
  onDraftName: (value: string) => void;
  onStartRename: (onu: Onu) => void;
  onSaveRename: (onu: Onu) => void;
  onPollOnu: (olt: Olt) => void;
  activePollingIds: string[];
  failedPolls: Record<string, FailedPollInfo>;
  successfulPolls: Record<string, SuccessfulPollInfo>;
  onSyncCustomers: () => void;
  syncingCustomers: boolean;
  onuCountByOlt: Record<string, number>;
}) {
  const oltMap = new Map(props.olts.map((olt) => [olt.id, olt]));
  const isAllOlts = props.selectedOltId === "ALL" || !props.selectedOlt;
  const polling = isAllOlts
    ? props.activePollingIds.length > 0
    : Boolean(
        props.selectedOlt &&
        props.activePollingIds.includes(props.selectedOlt.id),
      );
  const selectedFailedPoll = props.selectedOlt
    ? props.failedPolls[props.selectedOlt.id]
    : undefined;
  const selectedSuccessPoll = props.selectedOlt
    ? props.successfulPolls[props.selectedOlt.id]
    : undefined;
  const allOltsSuccessCount = Object.keys(props.successfulPolls).filter(
    (id) => !props.failedPolls[id],
  ).length;
  const latestAllSuccessPoll = Object.values(props.successfulPolls).find(
    (s) => !props.failedPolls[s.oltId],
  );
  const linkedCount = props.onus.filter((o) => Boolean(o.customerLink)).length;
  const billingLinkedCount = props.onus.filter((o) =>
    Boolean(o.customerLink?.idPelanggan),
  ).length;

  const totalItems = props.onus.length;
  const effectivePageSize =
    props.pageSize > 0 ? props.pageSize : Math.max(1, totalItems);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(Math.max(1, props.currentPage), totalPages);
  const startIndex = (safePage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
  const paginatedOnus = props.onus.slice(startIndex, endIndex);

  const pageNumbers: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push("ellipsis");
    const startPage = Math.max(2, safePage - 1);
    const endPage = Math.min(totalPages - 1, safePage + 1);
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push("ellipsis");
    pageNumbers.push(totalPages);
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-950">ONU/ONT</h1>
            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
              {isAllOlts
                ? `Semua OLT (${props.olts.length})`
                : props.selectedOlt?.name}
            </span>
            {props.selectedPon !== "ALL" && (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                PON {props.selectedPon}
              </span>
            )}
            {!polling && selectedFailedPoll && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                <CircleAlert
                  className="h-3 w-3 text-red-600"
                  aria-hidden="true"
                />
                Polling OLT Gagal
              </span>
            )}
            {!polling && !selectedFailedPoll && selectedSuccessPoll && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2
                  className="h-3 w-3 text-emerald-600"
                  aria-hidden="true"
                />
                Poll Berhasil • {selectedSuccessPoll.polledAt}
              </span>
            )}
            {!polling &&
              isAllOlts &&
              allOltsSuccessCount > 0 &&
              latestAllSuccessPoll && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2
                    className="h-3 w-3 text-emerald-600"
                    aria-hidden="true"
                  />
                  {allOltsSuccessCount}/{props.olts.length} OLT Poll OK •{" "}
                  {latestAllSuccessPoll.polledAt}
                </span>
              )}
          </div>
          <p className="text-sm text-slate-500">
            Data RX, suhu, dan kasus down dibaca dari OID OLT.{" "}
            {props.onus.length > 0 && (
              <span className="font-medium text-cyan-800">
                ({linkedCount}/{props.onus.length} terhubung PPPoE •{" "}
                {billingLinkedCount} pelanggan billing)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <select
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            value={props.selectedOltId}
            onChange={(event) => props.onSelectOlt(event.target.value)}
            aria-label="Filter OLT"
          >
            <option value="ALL">Semua OLT ({props.allOnusCount} ONU)</option>
            {props.olts.map((olt) => (
              <option key={olt.id} value={olt.id}>
                {olt.name} ({props.onuCountByOlt[olt.id] ?? 0} ONU)
                {props.failedPolls[olt.id] ? " — Gagal Poll" : ""}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            value={props.selectedPon}
            onChange={(event) => props.onSelectPon(event.target.value)}
            aria-label="Filter PON"
          >
            <option value="ALL">
              Semua PON ({props.oltFilteredCount} ONU)
            </option>
            {props.availablePons.map((item) => (
              <option key={item.ponPort} value={item.ponPort}>
                PON {item.ponPort} ({item.count} ONU)
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            value={props.pageSize}
            onChange={(event) =>
              props.onPageSizeChange(Number(event.target.value))
            }
            aria-label="Jumlah data per halaman"
          >
            {[25, 50, 68, 100, 200, 500].map((size) => (
              <option key={size} value={size}>
                {size} / halaman
              </option>
            ))}
            <option value={0}>Semua ({totalItems})</option>
          </select>

          <button
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 ${polling ? "animate-pulse" : ""}`}
            type="button"
            disabled={props.olts.length === 0 || polling}
            onClick={() => {
              if (props.selectedOlt) {
                props.onPollOnu(props.selectedOlt);
              } else {
                for (const olt of props.olts) {
                  props.onPollOnu(olt);
                }
              }
            }}
          >
            <RefreshCcw
              className={`h-4 w-4 ${polling ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {polling ? "Polling..." : isAllOlts ? "Poll Semua OLT" : "Poll ONU"}
          </button>

          <button
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-100 shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ${props.syncingCustomers ? "animate-pulse" : ""}`}
            type="button"
            disabled={props.syncingCustomers}
            onClick={props.onSyncCustomers}
          >
            <Router
              className={`h-4 w-4 ${props.syncingCustomers ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {props.syncingCustomers
              ? "Syncing Mikrotik..."
              : "Sync Mikrotik & Customer"}
          </button>

          <label className="relative block sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              placeholder="Cari OLT, nama, pelanggan, PPPoE, PON..."
              value={props.query}
              onChange={(event) => props.onQuery(event.target.value)}
            />
          </label>
        </div>
      </div>

      {props.onus.length === 0 ? (
        <EmptyState
          title="Belum ada data ONU/ONT"
          text="Setelah polling SNMP dibuat atau filter disesuaikan, daftar ONU dari OLT akan muncul di sini."
        />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/60">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama (SNMP)</th>
                  <th className="px-4 py-3 font-semibold">Pelanggan (ISP)</th>
                  <th className="px-4 py-3 font-semibold">PPPoE / Router</th>
                  <th className="px-4 py-3 font-semibold">OLT / PON</th>
                  <th className="px-4 py-3 font-semibold">MAC</th>
                  <th className="px-4 py-3 font-semibold">RX</th>
                  <th className="px-4 py-3 font-semibold">Suhu</th>
                  <th className="px-4 py-3 font-semibold">Kasus Down</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Sync</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedOnus.map((onu) => {
                  const onuOlt = oltMap.get(onu.oltId);
                  const rowRenameEnabled =
                    Boolean(onuOlt?.writeCommunity?.trim()) &&
                    onuOlt?.writeMode === "snmp" &&
                    supportsSnmpRename(onuOlt);
                  const rowRenameDisabledText =
                    onuOlt?.oidProfile === "hsgq-epon"
                      ? "EPON belum support"
                      : onuOlt?.oidProfile === "vsol-gpon"
                        ? "VSOL dilewati"
                        : "Rename nonaktif";

                  const link = onu.customerLink;
                  const offsetLabel =
                    link?.macOffset === 0
                      ? "Exact"
                      : link && link.macOffset > 0
                        ? `+${link.macOffset}`
                        : link
                          ? String(link.macOffset)
                          : "";

                  return (
                    <tr
                      key={onu.id}
                      className="bg-white/70 transition hover:bg-cyan-50/50"
                    >
                      <td className="px-4 py-3">
                        {props.editingOnuId === onu.id ? (
                          <input
                            className="h-9 w-full rounded-xl border border-slate-300 px-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                            value={props.draftName}
                            onChange={(event) =>
                              props.onDraftName(event.target.value)
                            }
                          />
                        ) : (
                          <span className="font-medium text-slate-950">
                            {onu.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link?.namaPelanggan ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">
                                {link.namaPelanggan}
                              </span>
                              <span
                                className={`inline-flex items-center rounded px-1 py-0.2 text-[10px] font-medium ${
                                  link.macSource === "active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {link.macSource === "active"
                                  ? "active"
                                  : "last-caller"}
                              </span>
                              {/* {link.statusLangganan && (
                                <span
                                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    link.statusLangganan.toLowerCase() === "on"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {link.statusLangganan}
                                </span>
                              )} */}
                            </div>
                            <p className="text-xs text-slate-500">
                              ID: {link.idPelanggan || "-"}
                              {link.namaLangganan
                                ? ` • ${link.namaLangganan}`
                                : ""}
                            </p>
                            {link.alamat && (
                              <p
                                className="max-w-[240px] truncate text-[11px] text-slate-400"
                                title={link.alamat}
                              >
                                {link.alamat}
                              </p>
                            )}
                          </div>
                        ) : link ? (
                          <span className="text-xs italic text-slate-400">
                            PPPoE tanpa data billing
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link ? (
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold ">
                                {link.ipSecret}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">
                                {link.routerName}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-mono">{link.pppoeMac}</span>

                              <span className="inline-flex items-center rounded bg-cyan-50 px-1 py-0.2 font-mono text-[10px] font-semibold text-cyan-800">
                                MAC {offsetLabel}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="space-y-0.5">
                          {onuOlt && (
                            <span className="inline-flex items-center rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-900">
                              {onuOlt.name}
                            </span>
                          )}
                          <div className="font-mono text-xs font-medium">
                            PON {onu.ponPort}:{onu.onuIndex}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {onu.serialNumber}
                      </td>

                      <td className="px-4 py-3">
                        <SignalBadge
                          value={formatRxPower(onu.rxPower)}
                          tone={rxTone(onu.rxPower)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SignalBadge
                          value={formatTemperature(onu.temperatureC)}
                          tone={temperatureTone(onu.temperatureC)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {onu.status === "online"
                          ? "-"
                          : onu.downReason || "Down"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={onu.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={onu.syncStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {props.editingOnuId === onu.id ? (
                          <button
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-800"
                            type="button"
                            onClick={() => props.onSaveRename(onu)}
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            Simpan
                          </button>
                        ) : rowRenameEnabled ? (
                          <button
                            className={secondaryButtonClass}
                            type="button"
                            onClick={() => props.onStartRename(onu)}
                          >
                            <Pencil
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Rename
                          </button>
                        ) : (
                          <span className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-500">
                            {rowRenameDisabledText}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Menampilkan{" "}
                <strong className="text-slate-900">
                  {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
                </strong>{" "}
                dari{" "}
                <strong className="text-slate-900">
                  {formatNumber(totalItems)}
                </strong>{" "}
                ONU (Halaman {safePage} dari {totalPages})
              </span>
              <label className="inline-flex items-center gap-1.5">
                <span>Baris per halaman:</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-cyan-500"
                  value={props.pageSize}
                  onChange={(event) =>
                    props.onPageSizeChange(Number(event.target.value))
                  }
                >
                  {[25, 50, 68, 100, 200, 500].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                  <option value={0}>Semua</option>
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => props.onPageChange(1)}
                  aria-label="Halaman pertama"
                  title="Halaman pertama"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => props.onPageChange(safePage - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Prev
                </button>

                {pageNumbers.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1.5 text-slate-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 font-semibold transition ${
                        item === safePage
                          ? "border-cyan-600 bg-cyan-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                      type="button"
                      onClick={() => props.onPageChange(item)}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => props.onPageChange(safePage + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => props.onPageChange(totalPages)}
                  aria-label="Halaman terakhir"
                  title="Halaman terakhir"
                >
                  <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
