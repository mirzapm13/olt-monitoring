"use client";

import { CheckCircle2, CircleAlert, RefreshCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MetricCard } from "@/components/metric-card";
import type {
  MonitoringState,
  Olt,
  Onu,
  TelegramSettings,
} from "@/lib/types";
import { AlertsView } from "./monitoring/alerts-view";
import { DashboardView } from "./monitoring/dashboard-view";
import { OltFormPanel, OltListPanel } from "./monitoring/olt-view";
import { OnuView } from "./monitoring/onu-view";
import { AboutView, SettingsView } from "./monitoring/settings-view";
import { SystemView } from "./monitoring/system-view";
import {
  ClearAlertsDialog,
  DeleteOltDialog,
  ToastNotice,
} from "./monitoring/ui-primitives";
import {
  emptyForm,
  emptyState,
  type ClearAlertsMode,
  type FailedPollInfo,
  type OltForm,
  type PollOnuNotification,
  type SuccessfulPollInfo,
  type ToastState,
  type ToastTone,
  type View,
} from "./monitoring/workspace-types";
import {
  buildOperationalAlerts,
  clearLegacyBrowserState,
  deviceLocationFromSystem,
  deviceTypeFromSystem,
  formatNumber,
  formFromOlt,
  profileForVendor,
  readLegacyBrowserState,
} from "./monitoring/workspace-utils";

export function MonitoringWorkspace({ view }: { view: View }) {
  const [storedState, setStoredState] = useState<MonitoringState>(emptyState);
  const [selectedOltId, setSelectedOltId] = useState("ALL");
  const [selectedPon, setSelectedPon] = useState("ALL");
  const [pageSize, setPageSize] = useState<number>(68);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingOltId, setEditingOltId] = useState<string | null>(null);
  const [activePollingIds, setActivePollingIds] = useState<string[]>([]);
  const [failedPolls, setFailedPolls] = useState<
    Record<string, FailedPollInfo>
  >({});
  const [successfulPolls, setSuccessfulPolls] = useState<
    Record<string, SuccessfulPollInfo>
  >({});
  const [dismissedFailedIds, setDismissedFailedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [editingOnuId, setEditingOnuId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [notice, setNotice] = useState("Memuat database monitoring...");
  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<OltForm>(emptyForm);
  const [deleteCandidate, setDeleteCandidate] = useState<Olt | null>(null);
  const [clearAlertsMode, setClearAlertsMode] =
    useState<ClearAlertsMode | null>(null);
  const stateRef = useRef(storedState);
  const pollingLocksRef = useRef(new Set<string>());
  const lastStateChangeRef = useRef<number>(0);
  const { alerts, olts, onus, settings } = storedState;

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
  }

  function nowJakarta() {
    return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  }

  useEffect(() => {
    stateRef.current = storedState;
  }, [storedState]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/monitoring/state")
      .then((response) => response.json() as Promise<MonitoringState>)
      .then((state) => {
        if (cancelled) return;
        const legacyState =
          state.olts.length === 0 ? readLegacyBrowserState() : null;
        const nextState = legacyState ?? state;

        stateRef.current = nextState;
        setStoredState(nextState);
        setSelectedOltId((curr) => curr || "ALL");
        setNotice(
          legacyState
            ? "Data OLT lama dari browser berhasil dimigrasikan ke database lokal."
            : nextState.olts.length === 0
              ? "Database awal kosong. Tambahkan OLT untuk mulai monitoring."
              : "Database OLT berhasil dimuat.",
        );

        if (legacyState) {
          void fetch("/api/monitoring/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(legacyState),
          }).then(() => clearLegacyBrowserState());
        } else {
          clearLegacyBrowserState();
        }
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Database belum bisa dibaca. Coba refresh atau cek server lokal.",
          );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const intervalMs = activePollingIds.length > 0 ? 1500 : 4000;

    async function checkPollingStatus() {
      try {
        const res = await fetch("/api/snmp/poll-onu");
        if (!res.ok) return;
        const data = (await res.json()) as {
          activePolls?: string[];
          failedPolls?: FailedPollInfo[];
          successfulPolls?: SuccessfulPollInfo[];
          lastStateChangeAt?: number;
        };
        if (cancelled) return;

        if (Array.isArray(data.failedPolls)) {
          const nextFailed: Record<string, FailedPollInfo> = {};
          for (const item of data.failedPolls) {
            nextFailed[item.oltId] = item;
          }
          setFailedPolls(nextFailed);
        }

        if (Array.isArray(data.successfulPolls)) {
          setSuccessfulPolls((prev) => {
            const next = { ...prev };
            for (const item of data.successfulPolls!) {
              next[item.oltId] = item;
            }
            return next;
          });
        }

        const stateChanged =
          typeof data.lastStateChangeAt === "number" &&
          data.lastStateChangeAt > 0 &&
          data.lastStateChangeAt !== lastStateChangeRef.current;

        if (typeof data.lastStateChangeAt === "number" && data.lastStateChangeAt > 0) {
          lastStateChangeRef.current = data.lastStateChangeAt;
        }

        if (Array.isArray(data.activePolls)) {
          const finishedPolling =
            activePollingIds.length > 0 && data.activePolls.length === 0;
          setActivePollingIds(data.activePolls);

          if (stateChanged || finishedPolling) {
            const stateRes = await fetch("/api/monitoring/state");
            if (stateRes.ok && !cancelled) {
              const nextState = (await stateRes.json()) as MonitoringState;
              stateRef.current = nextState;
              setStoredState(nextState);
            }
          }
        }
      } catch {
        // Ignore network errors on polling status check
      }
    }

    void checkPollingStatus();
    const timer = window.setInterval(() => void checkPollingStatus(), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePollingIds.length]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function commitState(nextState: MonitoringState) {
    stateRef.current = nextState;
    setStoredState(nextState);
    const response = await fetch("/api/monitoring/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextState),
    });
    if (!response.ok) throw new Error("Database gagal disimpan.");
    clearLegacyBrowserState();
  }

  function updateTelegramSettings(nextTelegram: TelegramSettings) {
    const nextState = {
      ...storedState,
      settings: {
        ...settings,
        telegram: nextTelegram,
      },
    };

    void commitState(nextState);
    setNotice("Setting Telegram tersimpan.");
  }

  async function testTelegram(settingsToTest: TelegramSettings) {
    setNotice("Mengirim test Telegram...");
    showToast("Mengirim test Telegram...", "info");

    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToTest),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      const message =
        result.message ||
        (response.ok ? "Test Telegram selesai." : "Test Telegram gagal.");

      setNotice(message);
      showToast(message, result.ok ? "success" : "error");
    } catch (error) {
      const message =
        error instanceof Error
          ? `Test Telegram gagal: ${error.message}`
          : "Test Telegram gagal dijalankan.";

      setNotice(message);
      showToast(message, "error");
    }
  }

  const isAllOltsSelected = selectedOltId === "ALL" || !selectedOltId;
  const selectedOlt = isAllOltsSelected
    ? undefined
    : (olts.find((olt) => olt.id === selectedOltId) ?? olts[0]);
  const [syncingCustomers, setSyncingCustomers] = useState(false);

  async function syncCustomersAndMikrotik() {
    if (syncingCustomers) return;
    setSyncingCustomers(true);
    setNotice("Menghubungkan ke 4 Router Mikrotik, isp_ops_db, dan olt_db...");
    showToast("Sync Mikrotik & Customer sedang berjalan...", "info");

    try {
      const response = await fetch("/api/customer-sync", {
        method: "POST",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        state?: MonitoringState;
      };

      if (result.state) {
        stateRef.current = result.state;
        setStoredState(result.state);
      }

      const msg =
        result.message ||
        (result.ok ? "Sync Mikrotik & Customer selesai." : "Sync gagal.");
      setNotice(msg);
      showToast(msg, result.ok ? "success" : "error");
    } catch (error) {
      const msg =
        error instanceof Error
          ? `Sync gagal: ${error.message}`
          : "Sync Mikrotik & Customer gagal.";
      setNotice(msg);
      showToast(msg, "error");
    } finally {
      setSyncingCustomers(false);
    }
  }

  const oltOrderMap = new Map(olts.map((olt, idx) => [olt.id, { olt, idx }]));
  const oltFilteredOnus = onus
    .filter((onu) =>
      isAllOltsSelected ? true : onu.oltId === selectedOlt?.id,
    )
    .sort((a, b) => {
      const oltIdxA = oltOrderMap.get(a.oltId)?.idx ?? 999;
      const oltIdxB = oltOrderMap.get(b.oltId)?.idx ?? 999;
      if (oltIdxA !== oltIdxB) return oltIdxA - oltIdxB;

      const ponDiff = String(a.ponPort).localeCompare(
        String(b.ponPort),
        undefined,
        { numeric: true },
      );
      if (ponDiff !== 0) return ponDiff;
      return String(a.onuIndex).localeCompare(String(b.onuIndex), undefined, {
        numeric: true,
      });
    });

  const ponCountsMap = new Map<string, number>();
  for (const onu of oltFilteredOnus) {
    const key = String(onu.ponPort);
    ponCountsMap.set(key, (ponCountsMap.get(key) ?? 0) + 1);
  }
  const availablePons = Array.from(ponCountsMap.entries())
    .map(([ponPort, count]) => ({ ponPort, count }))
    .sort((a, b) =>
      a.ponPort.localeCompare(b.ponPort, undefined, { numeric: true }),
    );
  const effectiveSelectedPon =
    selectedPon === "ALL" || ponCountsMap.has(selectedPon)
      ? selectedPon
      : "ALL";

  const ponFilteredOnus =
    effectiveSelectedPon === "ALL"
      ? oltFilteredOnus
      : oltFilteredOnus.filter(
          (onu) => String(onu.ponPort) === effectiveSelectedPon,
        );

  const filteredOnus = ponFilteredOnus.filter((onu) => {
    const oltName = oltOrderMap.get(onu.oltId)?.olt.name ?? "";
    const link = onu.customerLink;
    const linkText = link
      ? `${link.namaPelanggan ?? ""} ${link.idPelanggan ?? ""} ${link.ipSecret} ${link.routerName} ${link.pppoeMac} ${link.alamat ?? ""}`
      : "";
    const value =
      `${oltName} ${onu.name} ${onu.serialNumber} ${onu.ponPort}:${onu.onuIndex} ${onu.ponPort}/${onu.onuIndex} ${linkText}`.toLowerCase();
    return value.includes(query.toLowerCase());
  });

  const onlineOlts = olts.filter((olt) => olt.status === "online").length;
  const totalOnu = onus.length;
  const downOnu = onus.filter((onu) => onu.status !== "online").length;
  const operationalAlerts = buildOperationalAlerts(olts, onus, alerts);
  const openAlerts = operationalAlerts.filter(
    (alert) => !alert.acknowledged,
  ).length;
  const activelyPollingOltNames = olts
    .filter((olt) => activePollingIds.includes(olt.id))
    .map((olt) => olt.name);

  const effectiveFailedPolls: Record<string, FailedPollInfo> = {};
  const effectiveSuccessfulPolls: Record<string, SuccessfulPollInfo> = {};
  for (const olt of olts) {
    if (failedPolls[olt.id]) {
      effectiveFailedPolls[olt.id] = failedPolls[olt.id];
    } else if (olt.lastSeen?.startsWith("Gagal:")) {
      effectiveFailedPolls[olt.id] = {
        oltId: olt.id,
        oltName: olt.name,
        message: "Gagal menghubungi OLT saat polling SNMP terakhir.",
        failedAt: olt.lastSeen.replace(/^Gagal:\s*/, ""),
      };
    } else if (successfulPolls[olt.id]) {
      effectiveSuccessfulPolls[olt.id] = successfulPolls[olt.id];
    } else if (
      olt.status === "online" &&
      olt.lastSeen &&
      !olt.lastSeen.startsWith("Belum pernah")
    ) {
      effectiveSuccessfulPolls[olt.id] = {
        oltId: olt.id,
        oltName: olt.name,
        onlineCount: olt.activeOnu,
        polledAt: olt.lastSeen,
      };
    }
  }
  const visibleFailedPolls = Object.values(effectiveFailedPolls).filter(
    (item) => !dismissedFailedIds.includes(item.oltId),
  );
  const allSuccessfulPolls = Object.values(effectiveSuccessfulPolls);
  const latestSuccessTime =
    allSuccessfulPolls.find((item) => item.polledAt !== "Baru saja")?.polledAt ??
    allSuccessfulPolls[0]?.polledAt;

  function updateForm<K extends keyof OltForm>(key: K, value: OltForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateVendor(vendor: Olt["vendor"]) {
    setForm((current) => ({
      ...current,
      vendor,
      oidProfile: profileForVendor(vendor),
    }));
  }

  async function saveOlt() {
    const name = form.name.trim();
    const ipAddress = form.ipAddress.trim();
    const readCommunity = form.readCommunity.trim();
    const writeCommunity = form.writeCommunity.trim();
    const snmpPort = Number(form.snmpPort) || 161;
    const currentState = stateRef.current;
    const currentOlts = currentState.olts;

    if (!name || !ipAddress || !readCommunity) {
      setNotice("Nama OLT, IP/host, dan community SNMP wajib diisi.");
      return;
    }

    const oltPayload = {
      name,
      ipAddress,
      vendor: form.vendor,
      pollingInterval: Number(form.pollingInterval) || 60,
      snmpPort,
      readCommunity,
      writeCommunity,
      oidProfile: form.oidProfile,
      writeMode: form.writeMode,
    };

    const duplicateOlt = currentOlts.find(
      (olt) =>
        olt.id !== editingOltId &&
        olt.ipAddress.trim() === ipAddress &&
        (olt.snmpPort || 161) === snmpPort,
    );

    if (duplicateOlt) {
      setSelectedOltId(duplicateOlt.id);
      setNotice(
        `${duplicateOlt.name} sudah memakai IP/host dan port yang sama. Gunakan Edit jika ingin mengubah data OLT tersebut.`,
      );
      return;
    }

    if (editingOltId) {
      const nextState = {
        ...currentState,
        olts: currentOlts.map((olt) =>
          olt.id === editingOltId ? { ...olt, ...oltPayload } : olt,
        ),
      };

      try {
        await commitState(nextState);
        setSelectedOltId(editingOltId);
        setEditingOltId(null);
        setForm(emptyForm);
        setNotice(`${name} berhasil diperbarui.`);
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Database gagal disimpan.",
        );
      }
      return;
    }

    const nextOlt: Olt = {
      id: `olt-${Date.now()}`,
      ...oltPayload,
      model: "-",
      location: "-",
      status: "offline",
      uptime: "-",
      cpuLoad: 0,
      memoryLoad: 0,
      ponPorts: 0,
      activeOnu: 0,
      snmpVersion: "v2c",
      lastSeen: "Belum pernah dipolling",
    };
    const nextState = { ...currentState, olts: [...currentOlts, nextOlt] };

    try {
      await commitState(nextState);
      setSelectedOltId(nextOlt.id);
      setForm(emptyForm);
      setNotice(`${name} ditambahkan dan sudah tersimpan ke database lokal.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Database gagal disimpan.",
      );
    }
  }

  function startEditOlt(olt: Olt) {
    setEditingOltId(olt.id);
    setSelectedOltId(olt.id);
    setForm(formFromOlt(olt));
    setNotice(`Mode edit aktif untuk ${olt.name}.`);
  }

  function cancelEditOlt() {
    setEditingOltId(null);
    setForm(emptyForm);
    setNotice("Edit OLT dibatalkan.");
  }

  async function removeOlt(oltId: string) {
    const currentState = stateRef.current;
    const removedOlt = currentState.olts.find((olt) => olt.id === oltId);

    if (!removedOlt) {
      const message = "OLT sudah tidak ada di database.";
      setNotice(message);
      showToast(message, "info");
      return;
    }

    const nextState = {
      ...currentState,
      olts: currentState.olts.filter((olt) => olt.id !== oltId),
      onus: currentState.onus.filter((onu) => onu.oltId !== oltId),
      alerts: currentState.alerts.filter((alert) => alert.oltId !== oltId),
    };

    try {
      await commitState(nextState);
      setSelectedOltId((current) =>
        current === oltId ? (nextState.olts[0]?.id ?? "ALL") : current,
      );
      if (editingOltId === oltId) {
        setEditingOltId(null);
        setForm(emptyForm);
      }
      const message = `${removedOlt.name} berhasil dihapus. Data ONU/ONT dan alert terkait ikut dibersihkan.`;
      setNotice(message);
      showToast(message, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Database gagal disimpan.";
      setNotice(message);
      showToast(message, "error");
    }
  }

  async function clearStoredAlerts(mode: ClearAlertsMode) {
    const currentState = stateRef.current;
    const nextAlerts =
      mode === "acknowledged"
        ? currentState.alerts.filter((alert) => !alert.acknowledged)
        : [];
    const removedCount = currentState.alerts.length - nextAlerts.length;

    if (removedCount <= 0) {
      const message =
        mode === "acknowledged"
          ? "Belum ada alert selesai yang bisa dibersihkan."
          : "Belum ada riwayat alert yang tersimpan.";
      setNotice(message);
      showToast(message, "info");
      return;
    }

    try {
      await commitState({ ...currentState, alerts: nextAlerts });
      const message =
        mode === "acknowledged"
          ? `${removedCount} alert selesai berhasil dibersihkan.`
          : `${removedCount} riwayat alert berhasil dibersihkan. Alert aktif tetap muncul jika perangkat masih bermasalah.`;

      setNotice(message);
      showToast(message, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Alert gagal dibersihkan.";
      setNotice(message);
      showToast(message, "error");
    }
  }

  async function resetStorage() {
    const response = await fetch("/api/monitoring/state", { method: "DELETE" });
    if (!response.ok) {
      setNotice("Reset default gagal. Coba ulangi atau cek server lokal.");
      return;
    }

    stateRef.current = emptyState;
    setStoredState(emptyState);
    setSelectedOltId("ALL");
    clearLegacyBrowserState();
    setNotice("Reset default selesai. Database monitoring kembali kosong.");
  }

  function startRename(onu: Onu) {
    setEditingOnuId(onu.id);
    setDraftName(onu.name);
  }

  async function saveRename(onu: Onu) {
    const targetOlt = olts.find((olt) => olt.id === onu.oltId) ?? selectedOlt;
    if (!targetOlt) return;

    const response = await fetch("/api/onu/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ olt: targetOlt, onu, nextName: draftName }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      syncedToDevice: boolean;
      message: string;
    };

    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    const nextState = {
      ...storedState,
      onus: onus.map((item) =>
        item.id === onu.id
          ? {
              ...item,
              name: draftName.trim(),
              syncStatus: result.syncedToDevice
                ? ("synced" as const)
                : ("pending" as const),
            }
          : item,
      ),
    };

    void commitState(nextState);
    setEditingOnuId(null);
    setNotice(result.message);
  }

  async function testConnection(olt: Olt) {
    setNotice(`Menghubungi ${olt.ipAddress}:${olt.snmpPort} lewat SNMP...`);
    const response = await fetch("/api/snmp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(olt),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      values?: Record<string, string>;
    };
    const currentState = stateRef.current;
    const currentOlt = currentState.olts.find((item) => item.id === olt.id);

    if (!currentOlt) {
      setNotice(
        `${olt.name} sudah dihapus. Hasil test koneksi tidak disimpan.`,
      );
      return;
    }

    const nextState = {
      ...currentState,
      olts: currentState.olts.map((item) =>
        item.id === olt.id
          ? {
              ...item,
              status: result.ok ? ("online" as const) : ("offline" as const),
              lastSeen: result.ok
                ? nowJakarta()
                : item.lastSeen,
              uptime: result.values?.["1.3.6.1.2.1.1.3.0"] ?? item.uptime,
              model: deviceTypeFromSystem(result.values, item.model),
              location: deviceLocationFromSystem(result.values, item.location),
              systemInfo: result.values ?? item.systemInfo,
            }
          : item,
      ),
    };

    await commitState(nextState);
    setNotice(result.message);
  }

  async function testWriteCommunity(olt: Olt) {
    setNotice(`Mengetes Write Community untuk ${olt.name}...`);
    const response = await fetch("/api/snmp/test-write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(olt),
    });
    const result = (await response.json()) as { ok: boolean; message: string };

    setNotice(result.message);
  }

  async function pollOnu(olt: Olt, options: { silent?: boolean } = {}) {
    if (pollingLocksRef.current.has(olt.id)) return;

    const silent = Boolean(options.silent);
    pollingLocksRef.current.add(olt.id);
    setActivePollingIds((prev) =>
      prev.includes(olt.id) ? prev : [...prev, olt.id],
    );
    if (!silent) {
      setNotice(`Membaca data ONU/ONT dari ${olt.name}...`);
    }

    try {
      const response = await fetch("/api/snmp/poll-onu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(olt),
      });
      const result = (await response.json()) as {
        ok: boolean;
        message: string;
        polledAt?: string;
        onus?: Onu[];
        state?: MonitoringState;
        notification?: Partial<PollOnuNotification> & { message: string };
      };

      if (!result.ok) {
        const failedInfo: FailedPollInfo = {
          oltId: olt.id,
          oltName: olt.name,
          message: result.message || "Polling SNMP ke OLT gagal.",
          failedAt: nowJakarta(),
        };
        setFailedPolls((prev) => ({ ...prev, [olt.id]: failedInfo }));
        setDismissedFailedIds((prev) => prev.filter((id) => id !== olt.id));

        if (result.state) {
          stateRef.current = result.state;
          setStoredState(result.state);
        }
        if (
          result.notification &&
          ((result.notification.sent ?? 0) > 0 ||
            (result.notification.failed ?? 0) > 0)
        ) {
          showToast(
            result.notification.message,
            (result.notification.failed ?? 0) > 0 ? "error" : "success",
          );
        } else if (!silent) {
          showToast(
            `Polling ${olt.name} gagal: ${failedInfo.message}`,
            "error",
          );
        }
        if (!silent) setNotice(result.message);
        return;
      }

      const polledAt = result.polledAt || nowJakarta();
      const onlineCount =
        result.onus?.filter((onu) => onu.status === "online").length ?? 0;

      setFailedPolls((prev) => {
        if (!prev[olt.id]) return prev;
        const next = { ...prev };
        delete next[olt.id];
        return next;
      });
      setSuccessfulPolls((prev) => ({
        ...prev,
        [olt.id]: {
          oltId: olt.id,
          oltName: olt.name,
          onuCount: result.onus?.length,
          onlineCount,
          polledAt,
        },
      }));
      setDismissedFailedIds((prev) => prev.filter((id) => id !== olt.id));

      const currentState = stateRef.current;
      const nextOnus = [
        ...currentState.onus.filter((onu) => onu.oltId !== olt.id),
        ...(result.onus ?? []),
      ];
      const nextState =
        result.state ??
        ({
          ...currentState,
          onus: nextOnus,
          olts: currentState.olts.map((item) =>
            item.id === olt.id
              ? {
                  ...item,
                  status: "online" as const,
                  activeOnu: onlineCount,
                  lastSeen: polledAt,
                }
              : item,
          ),
        } satisfies MonitoringState);

      stateRef.current = nextState;
      setStoredState(nextState);

      const notificationMessage = result.notification?.message;
      if (!silent) {
        setNotice(
          notificationMessage
            ? `${result.message} ${notificationMessage}`
            : result.message,
        );
      }
      if (
        result.notification &&
        ((result.notification.sent ?? 0) > 0 ||
          (result.notification.failed ?? 0) > 0)
      ) {
        showToast(
          result.notification.message,
          (result.notification.failed ?? 0) > 0 ? "error" : "success",
        );
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Polling ONU gagal.";
      setFailedPolls((prev) => ({
        ...prev,
        [olt.id]: {
          oltId: olt.id,
          oltName: olt.name,
          message: errorMsg,
          failedAt: nowJakarta(),
        },
      }));
      setDismissedFailedIds((prev) => prev.filter((id) => id !== olt.id));
      if (!silent) {
        setNotice(errorMsg);
        showToast(`Polling ${olt.name} gagal: ${errorMsg}`, "error");
      }
    } finally {
      pollingLocksRef.current.delete(olt.id);
      setActivePollingIds((prev) => prev.filter((id) => id !== olt.id));
    }
  }

  return (
    <main className="p-4 lg:p-6">
      {toast && <ToastNotice toast={toast} onClose={() => setToast(null)} />}
      {deleteCandidate && (
        <DeleteOltDialog
          olt={deleteCandidate}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => {
            const target = deleteCandidate;
            setDeleteCandidate(null);
            void removeOlt(target.id);
          }}
        />
      )}
      {clearAlertsMode && (
        <ClearAlertsDialog
          mode={clearAlertsMode}
          savedCount={alerts.length}
          completedCount={alerts.filter((alert) => alert.acknowledged).length}
          activeCount={
            operationalAlerts.filter((alert) => !alert.acknowledged).length
          }
          onCancel={() => setClearAlertsMode(null)}
          onConfirm={() => {
            const mode = clearAlertsMode;
            setClearAlertsMode(null);
            void clearStoredAlerts(mode);
          }}
        />
      )}

      {activePollingIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-cyan-800 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 px-4 py-2.5 rounded-2xl text-sm font-medium animate-pulse shadow-sm">
          <RefreshCcw
            className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400 shrink-0"
            aria-hidden="true"
          />
          <span>
            Polling SNMP sedang berlangsung untuk:{" "}
            <strong>
              {activelyPollingOltNames.join(", ") || "perangkat OLT"}
            </strong>
          </span>
        </div>
      )}

      {visibleFailedPolls.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50/95 px-4 py-3 text-sm text-red-900 shadow-sm dark:border-red-800 dark:bg-red-950/60 dark:text-red-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  Polling OLT gagal ({visibleFailedPolls.length} perangkat):{" "}
                  <span>
                    {visibleFailedPolls.map((item) => item.oltName).join(", ")}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-red-800 dark:text-red-200">
                  {visibleFailedPolls.map((item) => (
                    <li key={item.oltId}>
                      <strong>{item.oltName}</strong>: {item.message}{" "}
                      <span className="opacity-75">({item.failedAt})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-2.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-700 dark:bg-red-900/60 dark:text-red-100"
                type="button"
                onClick={() => {
                  for (const item of visibleFailedPolls) {
                    const targetOlt = olts.find((o) => o.id === item.oltId);
                    if (targetOlt) void pollOnu(targetOlt);
                  }
                }}
              >
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Poll Ulang
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-white/70 text-red-700 transition hover:bg-white dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
                type="button"
                onClick={() =>
                  setDismissedFailedIds((prev) => [
                    ...new Set([
                      ...prev,
                      ...visibleFailedPolls.map((item) => item.oltId),
                    ]),
                  ])
                }
                aria-label="Tutup indikator gagal polling"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activePollingIds.length === 0 &&
        visibleFailedPolls.length === 0 &&
        allSuccessfulPolls.length > 0 && (
          <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                Polling SNMP terakhir berhasil:{" "}
                <strong>
                  {allSuccessfulPolls.length}/{olts.length} OLT
                </strong>{" "}
                online
                {latestSuccessTime ? (
                  <span className="ml-1 text-xs opacity-80">
                    (Terakhir: {latestSuccessTime})
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {allSuccessfulPolls.map((item) => (
                <span
                  key={item.oltId}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                  title={`Berhasil dipolling: ${item.polledAt}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {item.oltName}
                </span>
              ))}
            </div>
          </div>
        )}

      {(view === "dashboard" || view === "olts") && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="OLT Online"
            value={`${onlineOlts}/${olts.length}`}
            detail="Berdasarkan test SNMP terakhir"
            tone="cyan"
          />
          <MetricCard
            label="Total ONU"
            value={formatNumber(totalOnu)}
            detail="Akan terisi dari polling OLT"
            tone="emerald"
          />
          <MetricCard
            label="ONU Down"
            value={String(downOnu)}
            detail="Tidak online saat polling terakhir"
            tone="amber"
          />
          <MetricCard
            label="Alert Terbuka"
            value={String(openAlerts)}
            detail="Belum di-acknowledge"
            tone="red"
          />
        </div>
      )}

      {view === "dashboard" && (
        <DashboardView
          olts={olts}
          alerts={operationalAlerts}
          notice={notice}
          activePollingIds={activePollingIds}
          failedPolls={effectiveFailedPolls}
          successfulPolls={effectiveSuccessfulPolls}
        />
      )}

      {view === "olts" && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[420px_1fr]">
          <OltFormPanel
            form={form}
            editingOltName={olts.find((olt) => olt.id === editingOltId)?.name}
            onCancelEdit={cancelEditOlt}
            onSave={saveOlt}
            onUpdate={updateForm}
            onVendorChange={updateVendor}
          />
          <OltListPanel
            olts={olts}
            selectedOltId={selectedOlt?.id}
            notice={notice}
            onSelect={setSelectedOltId}
            onEdit={startEditOlt}
            onTest={testConnection}
            onTestWrite={testWriteCommunity}
            onPollOnu={pollOnu}
            activePollingIds={activePollingIds}
            failedPolls={effectiveFailedPolls}
            successfulPolls={effectiveSuccessfulPolls}
            onRemove={setDeleteCandidate}
          />
        </section>
      )}

      {view === "onus" && (
        <OnuView
          olts={olts}
          allOnusCount={onus.length}
          oltFilteredCount={oltFilteredOnus.length}
          onus={filteredOnus}
          selectedOltId={isAllOltsSelected ? "ALL" : (selectedOlt?.id ?? "ALL")}
          selectedOlt={selectedOlt}
          selectedPon={effectiveSelectedPon}
          availablePons={availablePons}
          pageSize={pageSize}
          currentPage={currentPage}
          query={query}
          editingOnuId={editingOnuId}
          draftName={draftName}
          onSelectOlt={(nextId) => {
            setSelectedOltId(nextId);
            setSelectedPon("ALL");
            setCurrentPage(1);
          }}
          onSelectPon={(nextPon) => {
            setSelectedPon(nextPon);
            setCurrentPage(1);
          }}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setCurrentPage(1);
          }}
          onPageChange={setCurrentPage}
          onQuery={(nextQuery) => {
            setQuery(nextQuery);
            setCurrentPage(1);
          }}
          onDraftName={setDraftName}
          onStartRename={startRename}
          onSaveRename={saveRename}
          onPollOnu={pollOnu}
          activePollingIds={activePollingIds}
          failedPolls={effectiveFailedPolls}
          successfulPolls={effectiveSuccessfulPolls}
          onSyncCustomers={syncCustomersAndMikrotik}
          syncingCustomers={syncingCustomers}
          onuCountByOlt={onus.reduce<Record<string, number>>((acc, item) => {
            acc[item.oltId] = (acc[item.oltId] ?? 0) + 1;
            return acc;
          }, {})}
        />
      )}

      {view === "alerts" && (
        <AlertsView
          alerts={operationalAlerts}
          savedAlerts={alerts}
          onClearAcknowledged={() => setClearAlertsMode("acknowledged")}
          onClearAll={() => setClearAlertsMode("all")}
        />
      )}
      {view === "about" && <AboutView />}
      {view === "settings" && (
        <SettingsView
          telegram={settings.telegram}
          onTelegramChange={updateTelegramSettings}
          onTestTelegram={testTelegram}
        />
      )}
      {view === "system" && (
        <SystemView onResetDefault={resetStorage} onToast={showToast} />
      )}
    </main>
  );
}
