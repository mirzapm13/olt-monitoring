import type { OidProfileKey } from "@/lib/oid-catalog";
import type { Alert, MonitoringState, Olt, Onu } from "@/lib/types";
import {
  emptyState,
  legacyStorageKey,
  type OltForm,
  type SignalTone,
  type StartupStatus,
} from "./workspace-types";

export function supportsSnmpRename(olt: Olt | undefined) {
  return olt?.oidProfile === "hsgq-gpon";
}

export function supportsSnmpWriteTest(olt: Olt | undefined) {
  return olt?.oidProfile === "hsgq-gpon";
}

export function startupDescription(status: StartupStatus) {
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

export function startupPlatformLabel(status: StartupStatus) {
  if (status.platform === "windows") return "Windows";
  if (status.platform === "linux") return "Linux";
  if (status.platform === "macos") return "macOS";
  if (status.platform) return status.platform;
  if (status.message) return "Belum terbaca";
  return "Memuat...";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function profileForVendor(vendor: Olt["vendor"]): OidProfileKey {
  if (vendor === "VSOL" || vendor === "VSOL GPON") return "vsol-gpon";
  if (vendor === "VSOL EPON V16004DL") return "vsol-epon-v16004dl";
  if (vendor === "VSOL EPON V1600D8") return "vsol-epon-v1600d8";
  if (vendor === "VSOL EPON") return "vsol-epon-v1600d8";
  if (vendor === "HSGQ GPON") return "hsgq-gpon";
  if (vendor === "HSGQ EPON") return "hsgq-epon";
  if (vendor === "HiOSO EPON") return "hioso-epon";
  return "generic";
}

export function formFromOlt(olt: Olt): OltForm {
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

export function readLegacyBrowserState() {
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

export function clearLegacyBrowserState() {
  window.localStorage.removeItem(legacyStorageKey);
}

export function oltAccent(olt: Olt) {
  if (olt.oidProfile === "hsgq-epon" || olt.vendor.includes("EPON")) {
    return {
      card: "border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white/75 to-teal-50/70 shadow-emerald-950/10 dark:from-emerald-950/45 dark:via-slate-900/70 dark:to-teal-950/45",
      selectedCard:
        "border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 shadow-emerald-900/15 dark:from-emerald-950/55 dark:via-teal-950/45 dark:to-cyan-950/35",
      icon: "bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-emerald-500/25",
      strip: "from-emerald-400 via-teal-300 to-cyan-300",
      tile: "border-slate-200 bg-transparent dark:border-slate-700/70",
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
      tile: "border-slate-200 bg-transparent dark:border-slate-700/70",
      label: "text-cyan-700",
    };
  }

  return {
    card: "border-amber-300/60 bg-gradient-to-br from-amber-50/85 via-white/75 to-orange-50/70 shadow-amber-950/10 dark:from-amber-950/40 dark:via-slate-900/70 dark:to-orange-950/40",
    selectedCard:
      "border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-amber-900/15 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-yellow-950/30",
    icon: "bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 shadow-amber-500/25",
    strip: "from-amber-300 via-orange-300 to-yellow-300",
    tile: "border-slate-200 bg-transparent dark:border-slate-700/70",
    label: "text-amber-700",
  };
}

export function cleanDisplayValue(value: string | undefined) {
  const text = String(value || "").trim();
  return text && text !== "-" ? text : "";
}

export function friendlySystemValue(
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

export function deviceTypeFromSystem(
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

export function deviceLocationFromSystem(
  values: Record<string, string> | undefined,
  fallback: string,
) {
  return (
    cleanDisplayValue(values?.["1.3.6.1.2.1.1.6.0"]) ||
    cleanDisplayValue(fallback) ||
    "-"
  );
}

export function displayDeviceType(olt: Olt) {
  return deviceTypeFromSystem(olt.systemInfo, olt.model);
}

export function displayLocation(olt: Olt) {
  return deviceLocationFromSystem(olt.systemInfo, olt.location);
}

function secondsToCompactUptime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "-";
  const sec = Math.floor(totalSeconds);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatOltUptime(olt: Olt): string {
  const raw = String(olt.uptime || "").trim();
  if (raw && raw !== "0" && raw !== "-") {
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      return secondsToCompactUptime(n > 100000000 ? n / 100 : n);
    }
    const d = raw.match(/(\d+)\s*Days?/i);
    const h = raw.match(/(\d+)\s*Hours?/i);
    const m = raw.match(/(\d+)\s*Minutes?/i);
    if (d || h || m) {
      const parts: string[] = [];
      if (d && Number(d[1]) > 0) parts.push(`${Number(d[1])}d`);
      if (h) parts.push(`${Number(h[1])}h`);
      if (m) parts.push(`${Number(m[1])}m`);
      return parts.join(" ") || raw;
    }
    return raw;
  }

  const sys = olt.systemInfo ?? {};
  const vsolUp = cleanDisplayValue(sys["1.3.6.1.4.1.37950.1.1.5.10.12.5.8.0"]);
  if (vsolUp) {
    const d = vsolUp.match(/(\d+)\s*Days?/i);
    const h = vsolUp.match(/(\d+)\s*Hours?/i);
    const m = vsolUp.match(/(\d+)\s*Minutes?/i);
    if (d || h || m) {
      const parts: string[] = [];
      if (d && Number(d[1]) > 0) parts.push(`${Number(d[1])}d`);
      if (h) parts.push(`${Number(h[1])}h`);
      if (m) parts.push(`${Number(m[1])}m`);
      return parts.join(" ") || vsolUp;
    }
    return vsolUp;
  }

  const hsgqSec = Number(sys["1.3.6.1.4.1.50224.3.1.1.3.0"] || 0);
  if (Number.isFinite(hsgqSec) && hsgqSec > 0) {
    return secondsToCompactUptime(hsgqSec);
  }

  const sysTicks = Number(sys["1.3.6.1.2.1.1.3.0"] || 0);
  if (Number.isFinite(sysTicks) && sysTicks > 0) {
    return secondsToCompactUptime(sysTicks / 100);
  }

  return "-";
}

export function displayOltTemperature(olt: Olt): number | null {
  const sys = olt.systemInfo ?? {};
  const raw =
    sys["oltTemperatureC"] ?? sys["1.3.6.1.4.1.37950.1.1.5.10.12.5.9.0"];
  if (!raw) return null;
  const val = Number(raw);
  return Number.isFinite(val) && val > -40 && val < 150 ? val : null;
}

export function loadTone(value: number): SignalTone {
  if (!Number.isFinite(value) || value <= 0) return "empty";
  if (value >= 85) return "critical";
  if (value >= 65) return "warning";
  return "good";
}

export function formatRxPower(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-";
  return `${value} dBm`;
}

export function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return `${value} C`;
}

export function rxTone(value: number): SignalTone {
  if (!Number.isFinite(value) || value === 0) return "empty";
  if (value <= -27 || value >= -8) return "critical";
  if (value <= -25 || value >= -10) return "warning";
  return "good";
}

export function temperatureTone(value: number | null | undefined): SignalTone {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "empty";
  if (value >= 60) return "critical";
  if (value >= 55) return "warning";
  return "good";
}

export function buildOnuAlertDetail(
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

export function buildOperationalAlerts(
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
