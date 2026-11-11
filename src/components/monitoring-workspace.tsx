"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  CircleCheck,
  Database,
  Eye,
  EyeOff,
  HeartHandshake,
  Info,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  Router,
  Save,
  Search,
  Shield,
  Trash2,
  UserCog,
  Wifi,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  authStorageKey,
  roleDescriptions,
  roleLabels,
  type AppRole,
  type AuthAuditLog,
  type AuthSession,
  type PublicUser,
} from "@/lib/auth-types";
import type { OidProfileKey } from "@/lib/oid-catalog";
import type {
  Alert,
  MonitoringState,
  Olt,
  Onu,
  TelegramSettings,
} from "@/lib/types";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";

type View =
  | "dashboard"
  | "olts"
  | "onus"
  | "alerts"
  | "settings"
  | "system"
  | "about";
type ToastTone = "info" | "success" | "error";
type ToastState = {
  message: string;
  tone: ToastTone;
} | null;
type ClearAlertsMode = "acknowledged" | "all";
type PollOnuNotification = {
  checked: number;
  downDetected: number;
  recoveryDetected: number;
  sent: number;
  failed: number;
  skipped: boolean;
  message: string;
};
type FailedPollInfo = {
  oltId: string;
  oltName: string;
  message: string;
  failedAt: string;
};
type StartupStatus = {
  enabled: boolean;
  path?: string;
  platform?: string;
  supported?: "automatic" | "manual" | "unsupported";
  message?: string;
  linux?: {
    serviceName: string;
    servicePath: string;
    service: string;
    commands: string[];
    disableCommands: string[];
  } | null;
};

const legacyStorageKey = "mikroin-monitor-state-v2";

type OltForm = {
  name: string;
  ipAddress: string;
  vendor: Olt["vendor"];
  snmpPort: string;
  readCommunity: string;
  writeCommunity: string;
  oidProfile: OidProfileKey;
  pollingInterval: string;
  writeMode: Olt["writeMode"];
};

const emptyState: MonitoringState = {
  olts: [],
  onus: [],
  alerts: [],
  settings: {
    telegram: {
      enabled: false,
      botToken: "",
      chatId: "",
      notifyOntDown: true,
      notifyRecovery: true,
      botPollingEnabled: false,
      lastUpdateId: 0,
    },
  },
};

const emptyForm: OltForm = {
  name: "",
  ipAddress: "",
  vendor: "VSOL",
  snmpPort: "161",
  readCommunity: "public",
  writeCommunity: "",
  oidProfile: "vsol-gpon",
  pollingInterval: "60",
  writeMode: "none",
};

const panelClass =
  "rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur";
const tableShellClass =
  "mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/60";
const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";
const secondaryButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
const cyanButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50";

function supportsSnmpRename(olt: Olt | undefined) {
  return olt?.oidProfile === "hsgq-gpon";
}

function supportsSnmpWriteTest(olt: Olt | undefined) {
  return olt?.oidProfile === "hsgq-gpon";
}

function startupDescription(status: StartupStatus) {
  if (status.platform === "windows") {
    return "Jika aktif, Mikroin Monitor akan menjalankan server lokal otomatis setelah Windows login.";
  }

  if (status.platform === "linux" || status.supported === "manual") {
    return "Linux memakai systemd. Gunakan tombol install otomatis jika server berjalan dengan akses root, atau jalankan command manual di bawah lewat terminal dengan sudo.";
  }

  if (status.platform === "macos") {
    return "Platform macOS belum didukung otomatis dari UI. Gunakan service manager bawaan OS jika ingin menjalankan server saat startup.";
  }

  return "Mikroin Monitor akan membaca platform server terlebih dahulu sebelum menampilkan panduan startup yang sesuai.";
}

function startupPlatformLabel(status: StartupStatus) {
  if (status.platform === "windows") return "Windows";
  if (status.platform === "linux") return "Linux";
  if (status.platform === "macos") return "macOS";
  if (status.platform) return status.platform;
  if (status.message) return "Belum terbaca";
  return "Memuat...";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function profileForVendor(vendor: Olt["vendor"]): OidProfileKey {
  if (vendor === "VSOL" || vendor === "VSOL GPON") return "vsol-gpon";
  if (vendor === "VSOL EPON V16004DL") return "vsol-epon-v16004dl";
  if (vendor === "VSOL EPON V1600D8") return "vsol-epon-v1600d8";
  if (vendor === "VSOL EPON") return "vsol-epon-v1600d8";
  if (vendor === "HSGQ GPON") return "hsgq-gpon";
  if (vendor === "HSGQ EPON") return "hsgq-epon";
  if (vendor === "HiOSO EPON") return "hioso-epon";
  return "generic";
}

function formFromOlt(olt: Olt): OltForm {
  return {
    name: olt.name,
    ipAddress: olt.ipAddress,
    vendor: olt.vendor,
    snmpPort: String(olt.snmpPort || 161),
    readCommunity: olt.readCommunity,
    writeCommunity: olt.writeCommunity ?? "",
    oidProfile: olt.oidProfile,
    pollingInterval: String(olt.pollingInterval || 60),
    writeMode: olt.writeMode,
  };
}

function readLegacyBrowserState() {
  const raw = window.localStorage.getItem(legacyStorageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MonitoringState>;
    if (!Array.isArray(parsed.olts) || parsed.olts.length === 0) return null;

    return {
      olts: parsed.olts,
      onus: Array.isArray(parsed.onus) ? parsed.onus : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      settings: {
        telegram: {
          ...emptyState.settings.telegram,
          ...(parsed.settings?.telegram ?? {}),
        },
      },
    };
  } catch {
    return null;
  }
}

function clearLegacyBrowserState() {
  window.localStorage.removeItem(legacyStorageKey);
}

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
  const pollOnuRef = useRef<
    (olt: Olt, options?: { silent?: boolean }) => Promise<void>
  >(async () => undefined);
  const { alerts, olts, onus, settings } = storedState;

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
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

  const syncServerActivePolls = useCallback(async () => {
    try {
      const res = await fetch("/api/snmp/poll-onu");
      if (!res.ok) return;
      const data = (await res.json()) as {
        activePolls?: string[];
        failedPolls?: FailedPollInfo[];
      };
      if (Array.isArray(data.activePolls)) {
        setActivePollingIds((current) => {
          const isSame =
            current.length === data.activePolls!.length &&
            current.every((id) => data.activePolls!.includes(id));
          return isSame ? current : data.activePolls!;
        });
      }
      if (Array.isArray(data.failedPolls)) {
        setFailedPolls((prev) => {
          const next = { ...prev };
          for (const item of data.failedPolls!) {
            next[item.oltId] = item;
          }
          return next;
        });
      }
    } catch {
      // Ignore network errors on active poll check
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncServerActivePolls();
  }, [syncServerActivePolls]);

  useEffect(() => {
    if (activePollingIds.length === 0) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/snmp/poll-onu");
        if (!res.ok) return;
        const data = (await res.json()) as {
          activePolls?: string[];
          failedPolls?: FailedPollInfo[];
        };
        if (Array.isArray(data.failedPolls)) {
          setFailedPolls((prev) => {
            const next = { ...prev };
            for (const item of data.failedPolls!) {
              next[item.oltId] = item;
            }
            return next;
          });
        }
        if (Array.isArray(data.activePolls)) {
          if (data.activePolls.length === 0) {
            const stateRes = await fetch("/api/monitoring/state");
            if (stateRes.ok) {
              const nextState = (await stateRes.json()) as MonitoringState;
              stateRef.current = nextState;
              setStoredState(nextState);
            }
            setActivePollingIds([]);
          } else {
            setActivePollingIds(data.activePolls);
          }
        }
      } catch {
        // Ignore network errors on polling status check
      }
    }, 1500);

    return () => window.clearInterval(interval);
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
    }
  }
  const visibleFailedPolls = Object.values(effectiveFailedPolls).filter(
    (item) => !dismissedFailedIds.includes(item.oltId),
  );

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
        current === oltId ? (nextState.olts[0]?.id ?? "") : current,
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
    setSelectedOltId("");
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
              lastSeen: result.ok ? "Baru saja" : item.lastSeen,
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
        onus?: Onu[];
        state?: MonitoringState;
        notification?: Partial<PollOnuNotification> & { message: string };
      };

      if (!result.ok) {
        const failedInfo: FailedPollInfo = {
          oltId: olt.id,
          oltName: olt.name,
          message: result.message || "Polling SNMP ke OLT gagal.",
          failedAt: new Date().toLocaleString("id-ID"),
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

      setFailedPolls((prev) => {
        if (!prev[olt.id]) return prev;
        const next = { ...prev };
        delete next[olt.id];
        return next;
      });
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
                  activeOnu:
                    result.onus?.filter((onu) => onu.status === "online")
                      .length ?? 0,
                  lastSeen: "Baru saja",
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
          failedAt: new Date().toLocaleString("id-ID"),
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

  useEffect(() => {
    pollOnuRef.current = pollOnu;
  });

  useEffect(() => {
    if (olts.length === 0) return;

    const timers = olts.map((olt) => {
      const intervalSeconds = Math.max(10, Number(olt.pollingInterval) || 60);
      return window.setInterval(() => {
        void pollOnuRef.current(olt, { silent: true });
      }, intervalSeconds * 1000);
    });

    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
    };
  }, [olts]);

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

function ToastNotice({
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

function DeleteOltDialog({
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

function ClearAlertsDialog({
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

function DashboardView({
  olts,
  alerts,
  notice,
  activePollingIds,
  failedPolls,
}: {
  olts: Olt[];
  alerts: Alert[];
  notice: string;
  activePollingIds: string[];
  failedPolls: Record<string, FailedPollInfo>;
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

function oltAccent(olt: Olt) {
  if (olt.oidProfile === "hsgq-epon" || olt.vendor.includes("EPON")) {
    return {
      card: "border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white/75 to-teal-50/70 shadow-emerald-950/10 dark:from-emerald-950/45 dark:via-slate-900/70 dark:to-teal-950/45",
      selectedCard:
        "border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 shadow-emerald-900/15 dark:from-emerald-950/55 dark:via-teal-950/45 dark:to-cyan-950/35",
      icon: "bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-emerald-500/25",
      strip: "from-emerald-400 via-teal-300 to-cyan-300",
      tile: "border-emerald-200/80 bg-emerald-50/55 dark:bg-emerald-950/25 dark:border-emerald-300/25",
      label: "text-emerald-700",
    };
  }

  if (olt.oidProfile === "hsgq-gpon" || olt.vendor.includes("GPON")) {
    return {
      card: "border-cyan-300/60 bg-gradient-to-br from-cyan-50/85 via-white/75 to-sky-50/70 shadow-cyan-950/10 dark:from-cyan-950/45 dark:via-slate-900/70 dark:to-sky-950/45",
      selectedCard:
        "border-cyan-300 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 shadow-cyan-900/15 dark:from-cyan-950/55 dark:via-sky-950/45 dark:to-blue-950/35",
      icon: "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow-cyan-500/25",
      strip: "from-cyan-400 via-sky-300 to-blue-300",
      tile: "border-cyan-200/80 bg-cyan-50/55 dark:bg-cyan-950/25 dark:border-cyan-300/25",
      label: "text-cyan-700",
    };
  }

  return {
    card: "border-amber-300/60 bg-gradient-to-br from-amber-50/85 via-white/75 to-orange-50/70 shadow-amber-950/10 dark:from-amber-950/40 dark:via-slate-900/70 dark:to-orange-950/40",
    selectedCard:
      "border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-amber-900/15 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-yellow-950/30",
    icon: "bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 shadow-amber-500/25",
    strip: "from-amber-300 via-orange-300 to-yellow-300",
    tile: "border-amber-200/80 bg-amber-50/55 dark:bg-amber-950/25 dark:border-amber-300/25",
    label: "text-amber-700",
  };
}

function OltSummary({
  olt,
  isPolling,
  failedPoll,
}: {
  olt: Olt;
  isPolling?: boolean;
  failedPoll?: FailedPollInfo;
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

function OltFormPanel({
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

function OltListPanel({
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

function OnuView(props: {
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
            <option value="ALL">Semua PON ({props.oltFilteredCount} ONU)</option>
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
            {polling
              ? "Polling..."
              : isAllOlts
                ? "Poll Semua OLT"
                : "Poll ONU"}
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
                  <th className="px-4 py-3 font-semibold">Serial</th>
                  <th className="px-4 py-3 font-semibold">OLT / PON</th>
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
                              {link.statusLangganan && (
                                <span
                                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    link.statusLangganan.toLowerCase() === "on"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {link.statusLangganan}
                                </span>
                              )}
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
                              <span className="inline-flex items-center rounded bg-cyan-50 px-1 py-0.2 font-mono text-[10px] font-semibold text-cyan-800">
                                MAC {offsetLabel}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {onu.serialNumber}
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

function AlertsView({
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

function AboutView() {
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

function SettingsView({
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

function SystemView({
  onResetDefault,
  onToast,
}: {
  onResetDefault: () => void;
  onToast: (message: string, tone?: ToastTone) => void;
}) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuthAuditLog[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState("");
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    enabled: false,
  });
  const [userForm, setUserForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "admin" as AppRole,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/users")
      .then(
        (response) =>
          response.json() as Promise<{
            users: PublicUser[];
            auditLogs: AuthAuditLog[];
          }>,
      )
      .then((result) => {
        if (cancelled) return;
        setUsers(result.users);
        setAuditLogs(result.auditLogs);
      })
      .catch(() => {
        if (cancelled) return;
        setUsers([]);
        setAuditLogs([]);
        setSystemMessage("Data user belum bisa dibaca.");
      });

    fetch("/api/system/startup")
      .then((response) => response.json() as Promise<StartupStatus>)
      .then((result) => {
        if (!cancelled) setStartupStatus(result);
      })
      .catch(() => {
        if (!cancelled)
          setStartupStatus({
            enabled: false,
            message: "Status startup belum bisa dibaca.",
          });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function currentActor() {
    try {
      const raw = window.localStorage.getItem(authStorageKey);
      if (!raw) return "unknown";
      const session = JSON.parse(raw) as AuthSession;
      return session.username;
    } catch {
      return "unknown";
    }
  }

  function updateSystemData(result: {
    users?: PublicUser[];
    auditLogs?: AuthAuditLog[];
    message?: string;
  }) {
    if (result.users) setUsers(result.users);
    if (result.auditLogs) setAuditLogs(result.auditLogs);
    if (result.message) setSystemMessage(result.message);
  }

  function clearUserForm() {
    setEditingUserId(null);
    setUserForm({ username: "", name: "", password: "", role: "admin" });
  }

  function editUser(user: PublicUser) {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      name: user.name,
      password: "",
      role: user.role,
    });
    setSystemMessage(
      `Mode edit aktif untuk ${user.username}. Isi password baru jika ingin mengganti password.`,
    );
  }

  async function saveUser() {
    const payload = {
      ...userForm,
      id: editingUserId ?? "",
      actor: currentActor(),
    };
    const response = await fetch("/api/auth/users", {
      method: editingUserId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      users?: PublicUser[];
      auditLogs?: AuthAuditLog[];
    };

    updateSystemData(result);
    if (result.ok) clearUserForm();
  }

  async function removeUser(user: PublicUser) {
    const approved = window.confirm(`Hapus user ${user.username}?`);
    if (!approved) return;

    const response = await fetch("/api/auth/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, actor: currentActor() }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      users?: PublicUser[];
      auditLogs?: AuthAuditLog[];
    };

    updateSystemData(result);
    if (result.ok && editingUserId === user.id) clearUserForm();
  }

  function resetDefault() {
    const approved = window.confirm(
      "Reset Default akan mengosongkan data OLT, ONU/ONT, alert, dan setting Telegram. Akun login tetap tersedia. Lanjutkan?",
    );
    if (approved) onResetDefault();
  }

  async function toggleStartup() {
    const nextMethod = startupStatus.enabled ? "DELETE" : "POST";
    const loadingMessage = startupStatus.enabled
      ? "Menonaktifkan startup otomatis..."
      : "Mengaktifkan startup otomatis...";

    onToast(loadingMessage, "info");

    try {
      const response = await fetch("/api/system/startup", {
        method: nextMethod,
      });
      const result = (await response.json()) as StartupStatus;
      const message = result.message ?? "Status startup diperbarui.";

      setStartupStatus(result);
      onToast(message, response.ok ? "success" : "error");
    } catch (error) {
      onToast(
        error instanceof Error
          ? `Startup otomatis gagal: ${error.message}`
          : "Startup otomatis gagal diperbarui.",
        "error",
      );
    }
  }

  const roleAccess: Array<{ role: AppRole; access: string[]; tone: string }> = [
    {
      role: "admin",
      access: ["Dashboard", "OLT", "ONU/ONT", "Alert"],
      tone: "border-cyan-200 bg-cyan-50/70 text-cyan-900 dark:bg-cyan-950/25 dark:text-cyan-50",
    },
    {
      role: "super-admin",
      access: ["Semua menu", "Setting Telegram", "System", "Reset Default"],
      tone: "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-50",
    },
  ];

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">System</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola role akses, akun lokal, dan reset default aplikasi.
          </p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-400 text-slate-950 shadow-lg shadow-violet-500/20">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <UserCog className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Akun dan Role
                </p>
                <p className="text-xs text-slate-500">
                  Akun lokal untuk masuk ke Mikroin Monitor.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_360px]">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
                {users.map((user) => {
                  const isLastSuperAdmin =
                    user.role === "super-admin" &&
                    users.filter((item) => item.role === "super-admin")
                      .length <= 1;

                  return (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{user.username}
                          </p>
                        </div>
                        <span className="rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">
                          {roleLabels[user.role]}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        {roleDescriptions[user.role]}
                      </p>
                      {isLastSuperAdmin && (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          Super Admin terakhir
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => editUser(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                          type="button"
                          disabled={isLastSuperAdmin}
                          title={
                            isLastSuperAdmin
                              ? "Super Admin terakhir tidak bisa dihapus"
                              : "Hapus user"
                          }
                          onClick={() => void removeUser(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {isLastSuperAdmin ? "Tidak bisa dihapus" : "Hapus"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm dark:bg-violet-950/20">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between 2xl:flex-col">
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {editingUserId ? "Edit User" : "Tambah User"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {editingUserId
                        ? "Kosongkan password jika tidak ingin mengganti password."
                        : "Buat akun lokal baru untuk operator."}
                    </p>
                  </div>
                  {editingUserId && (
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={clearUserForm}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  <TextInput
                    label="Username"
                    value={userForm.username}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        username: value,
                      }))
                    }
                    placeholder="teknisi01"
                  />
                  <TextInput
                    label="Nama"
                    value={userForm.name}
                    onChange={(value) =>
                      setUserForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Teknisi Area"
                  />
                  <TextInput
                    label={
                      editingUserId ? "Password Baru (opsional)" : "Password"
                    }
                    value={userForm.password}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    placeholder={
                      editingUserId
                        ? "Isi untuk ganti password"
                        : "Minimal 6 karakter"
                    }
                    type="password"
                  />
                  <SelectInput
                    label="Role"
                    value={userForm.role}
                    options={["admin", "super-admin"]}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        role: value as AppRole,
                      }))
                    }
                  />
                </div>
                <button
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-cyan-700 px-4 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition hover:from-violet-600 hover:to-cyan-600"
                  type="button"
                  onClick={() => void saveUser()}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {editingUserId ? "Simpan User" : "Tambah User"}
                </button>
                {systemMessage && (
                  <p className="mt-3 rounded-2xl border border-violet-300 bg-violet-100 p-3 text-sm font-semibold leading-6 text-violet-950 shadow-sm dark:border-violet-400/30 dark:bg-violet-950/45 dark:text-violet-50">
                    {systemMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-sm font-bold text-slate-950">Hak Akses Role</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {roleAccess.map((item) => (
                  <div
                    key={item.role}
                    className={`rounded-2xl border p-4 ${item.tone}`}
                  >
                    <p className="text-sm font-extrabold">
                      {roleLabels[item.role]}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.access.map((access) => (
                        <span
                          key={access}
                          className="rounded-full border border-current/20 bg-white/45 px-2.5 py-1 text-xs font-bold"
                        >
                          {access}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <Power className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">
                  Jalankan saat startup
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-200">
                  Platform: {startupPlatformLabel(startupStatus)} | Status:{" "}
                  {startupStatus.enabled ? "Aktif" : "Nonaktif"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-emerald-800 dark:text-emerald-100">
              {startupDescription(startupStatus)}
            </p>
            {startupStatus.path && (
              <p className="mt-2 break-all text-xs text-emerald-700 dark:text-emerald-200">
                {startupStatus.path}
              </p>
            )}
            {startupStatus.supported === "automatic" && (
              <button
                className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-lg transition ${
                  startupStatus.enabled
                    ? "bg-slate-700 shadow-slate-900/20 hover:bg-slate-600"
                    : "bg-emerald-700 shadow-emerald-900/20 hover:bg-emerald-600"
                }`}
                type="button"
                onClick={() => void toggleStartup()}
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {startupStatus.enabled
                  ? "Nonaktifkan Startup"
                  : "Aktifkan Startup"}
              </button>
            )}
            {startupStatus.supported === "manual" && startupStatus.linux && (
              <div className="mt-4 space-y-3">
                <button
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-lg transition ${
                    startupStatus.enabled
                      ? "bg-slate-700 shadow-slate-900/20 hover:bg-slate-600"
                      : "bg-emerald-700 shadow-emerald-900/20 hover:bg-emerald-600"
                  }`}
                  type="button"
                  onClick={() => void toggleStartup()}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {startupStatus.enabled
                    ? "Nonaktifkan Startup Linux"
                    : "Install Startup Otomatis"}
                </button>
                <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
                  <p className="text-xs font-bold text-emerald-900">
                    Command aktifkan systemd
                  </p>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-emerald-100">
                    {startupStatus.linux.commands.join("\n\n")}
                  </pre>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <p className="text-xs font-bold text-slate-900">
                    Command nonaktifkan
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                    {startupStatus.linux.disableCommands.join("\n")}
                  </pre>
                </div>
              </div>
            )}
            {startupStatus.supported === "unsupported" && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Platform ini belum didukung otomatis. Gunakan service manager
                bawaan OS.
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-950">Audit Log</p>
            <p className="mt-1 text-xs text-slate-500">
              Aktivitas login dan perubahan user terbaru.
            </p>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Belum ada audit log.
                </p>
              ) : (
                auditLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-950">
                        {log.action}
                      </span>
                      <span className="text-slate-400">{log.createdAt}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{log.detail}</p>
                    <p className="mt-1 font-semibold text-cyan-700">
                      Actor: {log.actor}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-red-200 bg-red-50/70 p-5 shadow-sm dark:bg-red-950/20">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-red-700 shadow-sm">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-red-900 dark:text-red-50">
                  Reset Default
                </p>
                <p className="text-xs text-red-700 dark:text-red-200">
                  Mengosongkan database monitoring lokal.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-red-800 dark:text-red-100">
              Data OLT, ONU/ONT, alert, dan setting Telegram akan kembali
              kosong. Akun login tetap bisa digunakan.
            </p>
            <button
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-600"
              type="button"
              onClick={resetDefault}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Reset Default
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TextInput({
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

function ToggleInput({
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

function SelectInput({
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

function formatRxPower(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-";
  return `${value} dBm`;
}

function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return `${value} C`;
}

type SignalTone = "good" | "warning" | "critical" | "empty";

function rxTone(value: number): SignalTone {
  if (!Number.isFinite(value) || value === 0) return "empty";
  if (value <= -27 || value >= -8) return "critical";
  if (value <= -25 || value >= -10) return "warning";
  return "good";
}

function temperatureTone(value: number | null | undefined): SignalTone {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "empty";
  if (value >= 60) return "critical";
  if (value >= 55) return "warning";
  return "good";
}

function SignalBadge({ value, tone }: { value: string; tone: SignalTone }) {
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
      dot: "bg-cyan-400 shadow-cyan-400/50",
      label: "text-cyan-700 dark:text-cyan-200",
      value: "text-cyan-950 dark:text-cyan-50",
    };
  }

  if (text.includes("tipe")) {
    return {
      strip: "from-sky-400 via-blue-300 to-cyan-200",
      dot: "bg-sky-400 shadow-sky-400/50",
      label: "text-sky-700 dark:text-sky-200",
      value: "text-sky-950 dark:text-sky-50",
    };
  }

  if (text.includes("firmware")) {
    return {
      strip: "from-amber-300 via-orange-300 to-yellow-200",
      dot: "bg-amber-400 shadow-amber-400/50",
      label: "text-amber-700 dark:text-amber-200",
      value: "text-amber-950 dark:text-amber-50",
    };
  }

  if (text.includes("lokasi")) {
    return {
      strip: "from-emerald-400 via-teal-300 to-lime-200",
      dot: "bg-emerald-400 shadow-emerald-400/50",
      label: "text-emerald-700 dark:text-emerald-200",
      value: "text-emerald-950 dark:text-emerald-50",
    };
  }

  return {
    strip: "from-lime-300 via-emerald-300 to-cyan-200",
    dot: "bg-lime-400 shadow-lime-400/50",
    label: "text-lime-700 dark:text-lime-200",
    value: "text-lime-950 dark:text-lime-50",
  };
}

function InfoTile({
  label,
  value,
  tone = "border-slate-200 bg-white/70",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const accent = infoTileAccent(label);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 shadow-sm ${tone}`}
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

function friendlySystemValue(
  olt: Olt,
  field: "name" | "firmware" | "location",
) {
  const values = olt.systemInfo ?? {};
  const map = {
    name: values["1.3.6.1.2.1.1.5.0"] || olt.name,
    firmware:
      cleanDisplayValue(values["1.3.6.1.4.1.25355.3.1.8.1.1.2.1"]) ||
      cleanDisplayValue(values["1.3.6.1.4.1.50224.3.1.1.6.0"]) ||
      cleanDisplayValue(values["1.3.6.1.4.1.37950.1.1.5.10.12.5.4.0"]) ||
      cleanDisplayValue(values["1.3.6.1.4.1.37950.1.1.5.10.14.6.0"]) ||
      cleanDisplayValue(values["1.3.6.1.4.1.37950.1.1.5.10.14.5.0"]) ||
      "-",
    location: values["1.3.6.1.2.1.1.6.0"] || olt.location,
  };

  return map[field];
}

function cleanDisplayValue(value: string | undefined) {
  const text = String(value || "").trim();

  return text && text !== "-" ? text : "";
}

function deviceTypeFromSystem(
  values: Record<string, string> | undefined,
  fallback: string,
) {
  return (
    cleanDisplayValue(values?.["1.3.6.1.4.1.25355.3.1.8.1.1.2.1"]) ||
    cleanDisplayValue(values?.["1.3.6.1.4.1.50224.3.1.1.19.0"]) ||
    cleanDisplayValue(values?.["1.3.6.1.4.1.37950.1.1.5.10.14.1.0"]) ||
    cleanDisplayValue(values?.["1.3.6.1.2.1.1.1.0"]) ||
    cleanDisplayValue(fallback) ||
    "-"
  );
}

function deviceLocationFromSystem(
  values: Record<string, string> | undefined,
  fallback: string,
) {
  return (
    cleanDisplayValue(values?.["1.3.6.1.2.1.1.6.0"]) ||
    cleanDisplayValue(fallback) ||
    "-"
  );
}

function displayDeviceType(olt: Olt) {
  return deviceTypeFromSystem(olt.systemInfo, olt.model);
}

function displayLocation(olt: Olt) {
  return deviceLocationFromSystem(olt.systemInfo, olt.location);
}

function buildOnuAlertDetail(
  onu: Onu,
  olt: Olt | undefined,
  extraLine?: string,
) {
  return [
    `Nama pelanggan: ${onu.name}`,
    `OLT: ${olt?.name ?? "-"}`,
    `PON: ${onu.ponPort}:${onu.onuIndex}`,
    `Serial: ${onu.serialNumber || "-"}`,
    `Status: ${onu.status}`,
    `RX: ${formatRxPower(onu.rxPower)}`,
    `Suhu: ${formatTemperature(onu.temperatureC)}`,
    `Kasus Down: ${onu.status === "online" ? "-" : onu.downReason || "Down"}`,
    `Last Seen: ${onu.lastSeen}`,
    extraLine,
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildOperationalAlerts(
  olts: Olt[],
  onus: Onu[],
  savedAlerts: Alert[],
) {
  const generated: Alert[] = [];

  for (const olt of olts) {
    if (olt.status !== "online") {
      generated.push({
        id: `olt-${olt.id}-offline`,
        oltId: olt.id,
        title: `${olt.name} tidak online`,
        detail: `OLT ${olt.ipAddress} belum berhasil dipolling. Cek koneksi, community, atau akses jaringan.`,
        severity: "critical",
        createdAt: olt.lastSeen,
        acknowledged: false,
      });
    }
  }

  for (const onu of onus) {
    const olt = olts.find((item) => item.id === onu.oltId);
    const hasSavedDownAlert = savedAlerts.some(
      (alert) =>
        !alert.acknowledged && alert.id.startsWith(`onu-${onu.id}-down-`),
    );

    if (onu.status !== "online") {
      if (!hasSavedDownAlert) {
        generated.push({
          id: `onu-${onu.id}-down`,
          oltId: onu.oltId,
          title: `ONT down: ${onu.name}`,
          detail: buildOnuAlertDetail(onu, olt),
          severity: "critical",
          createdAt: onu.lastSeen,
          acknowledged: false,
        });
      }
      continue;
    }

    if (onu.rxPower <= -27) {
      generated.push({
        id: `onu-${onu.id}-rx-critical`,
        oltId: onu.oltId,
        title: `RX lemah: ${onu.name}`,
        detail: buildOnuAlertDetail(
          onu,
          olt,
          "Catatan: Perlu pengecekan redaman.",
        ),
        severity: "warning",
        createdAt: onu.lastSeen,
        acknowledged: false,
      });
    }

    if (
      onu.temperatureC !== null &&
      onu.temperatureC !== undefined &&
      onu.temperatureC >= 55
    ) {
      generated.push({
        id: `onu-${onu.id}-temperature`,
        oltId: onu.oltId,
        title: `Suhu tinggi: ${onu.name}`,
        detail: buildOnuAlertDetail(
          onu,
          olt,
          "Catatan: Perlu cek modul/lingkungan ONT.",
        ),
        severity: "warning",
        createdAt: onu.lastSeen,
        acknowledged: false,
      });
    }
  }

  return [...generated, ...savedAlerts];
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
