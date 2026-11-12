"use client";

import {
  CheckCircle2,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCcw,
  Router,
  Save,
  Trash2,
  Wifi,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Olt } from "@/lib/types";
import {
  EmptyState,
  InfoTile,
  SelectInput,
  TextInput,
} from "./ui-primitives";
import {
  cyanButtonClass,
  panelClass,
  secondaryButtonClass,
  type FailedPollInfo,
  type OltForm,
  type SuccessfulPollInfo,
} from "./workspace-types";
import {
  displayDeviceType,
  displayLocation,
  friendlySystemValue,
  oltAccent,
  supportsSnmpWriteTest,
} from "./workspace-utils";

function OltHeaderInfo({
  olt,
  accent,
  onSelect,
}: {
  olt: Olt;
  accent: ReturnType<typeof oltAccent>;
  onSelect: () => void;
}) {
  return (
    <button
      className="flex items-start gap-3 text-left"
      type="button"
      onClick={onSelect}
    >
      <span
        className={`mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg ${accent.icon}`}
      >
        <Router className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-base font-bold text-slate-950">
          {olt.name}
        </span>
        <span className={`block text-xs font-semibold ${accent.label}`}>
          {olt.vendor}
        </span>
        <span className="block text-xs text-slate-500">
          {olt.ipAddress}:{olt.snmpPort}
        </span>
        <span className="block text-xs text-slate-500">
          Last seen: {olt.lastSeen} | ONU online: {olt.activeOnu}
        </span>
      </span>
    </button>
  );
}

export function OltFormPanel({
  form,
  editingOltName,
  onCancelEdit,
  onSave,
  onUpdate,
  onVendorChange,
}: {
  form: OltForm;
  editingOltName?: string;
  onCancelEdit: () => void;
  onSave: () => void;
  onUpdate: <K extends keyof OltForm>(key: K, value: OltForm[K]) => void;
  onVendorChange: (vendor: Olt["vendor"]) => void;
}) {
  const isEditing = Boolean(editingOltName);

  return (
    <section className={panelClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">
            {isEditing ? "Edit OLT" : "Tambah OLT"}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isEditing
              ? `Mengubah konfigurasi ${editingOltName}.`
              : "Masukkan akses SNMP untuk mulai monitoring."}
          </p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
          <Router className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <TextInput
          label="Nama OLT"
          value={form.name}
          onChange={(value) => onUpdate("name", value)}
          placeholder="OLT-AREA-01"
        />
        <TextInput
          label="IP/Host"
          value={form.ipAddress}
          onChange={(value) => onUpdate("ipAddress", value)}
          placeholder="192.168.1.10"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectInput
            label="Vendor"
            value={form.vendor}
            onChange={(value) => onVendorChange(value as Olt["vendor"])}
            options={[
              "VSOL GPON",
              "VSOL EPON V16004DL",
              "VSOL EPON V1600D8",
              "HSGQ GPON",
              "HSGQ EPON",
              "HiOSO EPON",
              "Huawei",
              "ZTE",
              "FiberHome",
              "Other",
            ]}
          />
          <SelectInput
            label="Mode rename ONU"
            value={form.writeMode}
            onChange={(value) =>
              onUpdate("writeMode", value as Olt["writeMode"])
            }
            options={["none", "snmp", "cli", "api"]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Port"
            value={form.snmpPort}
            onChange={(value) => onUpdate("snmpPort", value)}
            placeholder="161"
          />
          <TextInput
            label="Community"
            value={form.readCommunity}
            onChange={(value) => onUpdate("readCommunity", value)}
            placeholder="public"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Write Community"
            value={form.writeCommunity}
            onChange={(value) => onUpdate("writeCommunity", value)}
            placeholder="private atau sama dengan community"
          />
          <TextInput
            label="Polling (detik)"
            value={form.pollingInterval}
            onChange={(value) => onUpdate("pollingInterval", value)}
            placeholder="60 detik"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-700 to-sky-700 px-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 transition hover:from-cyan-600 hover:to-sky-600"
            type="button"
            onClick={onSave}
          >
            {isEditing ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {isEditing ? "Simpan Perubahan" : "Simpan OLT"}
          </button>
          {isEditing && (
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={onCancelEdit}
            >
              Batal Edit
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function OltListPanel({
  olts,
  selectedOltId,
  notice,
  onSelect,
  onEdit,
  onTest,
  onTestWrite,
  onPollOnu,
  activePollingIds,
  failedPolls,
  successfulPolls,
  onRemove,
}: {
  olts: Olt[];
  selectedOltId?: string;
  notice: string;
  onSelect: (id: string) => void;
  onEdit: (olt: Olt) => void;
  onTest: (olt: Olt) => void;
  onTestWrite: (olt: Olt) => void;
  onPollOnu: (olt: Olt) => void;
  activePollingIds: string[];
  failedPolls: Record<string, FailedPollInfo>;
  successfulPolls: Record<string, SuccessfulPollInfo>;
  onRemove: (olt: Olt) => void;
}) {
  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Daftar OLT</h2>
          <p className="text-sm text-slate-500">{notice}</p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {olts.length} perangkat
        </span>
      </div>
      {olts.length === 0 ? (
        <EmptyState
          title="Database masih kosong"
          text="Tambahkan IP OLT asli di form sebelah kiri."
        />
      ) : (
        <div className="mt-4 space-y-3">
          {olts.map((olt) => {
            const accent = oltAccent(olt);
            const selected = selectedOltId === olt.id;
            const isPolling = activePollingIds.includes(olt.id);
            const failedPoll = failedPolls[olt.id];
            const successPoll = successfulPolls[olt.id];

            return (
              <div
                key={olt.id}
                className={`relative grid overflow-hidden rounded-3xl border p-5 shadow-sm transition md:grid-cols-[1fr_auto] ${
                  !isPolling && failedPoll
                    ? "border-red-300 bg-gradient-to-br from-red-50/85 via-white/85 to-rose-50/75 shadow-red-950/10"
                    : selected
                      ? accent.selectedCard
                      : `${accent.card} hover:-translate-y-0.5 hover:shadow-lg`
                }`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${
                    !isPolling && failedPoll
                      ? "from-red-500 via-rose-400 to-orange-400"
                      : accent.strip
                  }`}
                />
                <OltHeaderInfo
                  olt={olt}
                  accent={accent}
                  onSelect={() => onSelect(olt.id)}
                />
                <div className="flex flex-wrap items-center gap-2">
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
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => onEdit(olt)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => onTest(olt)}
                  >
                    <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                    Test
                  </button>
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => onTestWrite(olt)}
                    disabled={
                      !olt.writeCommunity?.trim() ||
                      olt.writeMode !== "snmp" ||
                      !supportsSnmpWriteTest(olt)
                    }
                    title={
                      !supportsSnmpWriteTest(olt)
                        ? "Vendor ini belum punya test write SNMP"
                        : !olt.writeCommunity?.trim()
                          ? "Isi Write Community untuk mengaktifkan test write"
                          : "Test Write Community"
                    }
                  >
                    <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                    Test Write
                  </button>
                  <button
                    className={`${cyanButtonClass} ${isPolling ? "animate-pulse" : ""}`}
                    type="button"
                    disabled={isPolling}
                    onClick={() => onPollOnu(olt)}
                  >
                    <RefreshCcw
                      className={`h-3.5 w-3.5 ${isPolling ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    {isPolling ? "Polling..." : "Poll ONU"}
                  </button>
                  <button
                    className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-white px-2.5 text-red-700 shadow-sm transition hover:bg-red-50"
                    type="button"
                    onClick={() => onRemove(olt)}
                    aria-label={`Hapus ${olt.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid gap-2 text-xs md:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoTile
                    label="Nama perangkat"
                    value={friendlySystemValue(olt, "name")}
                    tone={accent.tile}
                  />
                  <InfoTile
                    label="Tipe perangkat"
                    value={displayDeviceType(olt)}
                    tone={accent.tile}
                  />
                  <InfoTile
                    label="Firmware"
                    value={friendlySystemValue(olt, "firmware")}
                    tone={accent.tile}
                  />
                  <InfoTile
                    label="Lokasi"
                    value={displayLocation(olt)}
                    tone={accent.tile}
                  />
                </div>
                {!isPolling && failedPoll && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-3.5 py-2 text-xs text-red-800 md:col-span-2 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200">
                    <CircleAlert
                      className="h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>Polling SNMP Gagal:</strong> {failedPoll.message}{" "}
                      <span className="opacity-75">
                        ({failedPoll.failedAt})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
