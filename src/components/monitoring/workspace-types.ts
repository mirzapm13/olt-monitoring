import type { OidProfileKey } from "@/lib/oid-catalog";
import type { MonitoringState, Olt } from "@/lib/types";

export type View =
  | "dashboard"
  | "olts"
  | "onus"
  | "alerts"
  | "settings"
  | "system"
  | "about";

export type ToastTone = "info" | "success" | "error";

export type ToastState = {
  message: string;
  tone: ToastTone;
} | null;

export type ClearAlertsMode = "acknowledged" | "all";

export type PollOnuNotification = {
  checked: number;
  downDetected: number;
  recoveryDetected: number;
  sent: number;
  failed: number;
  skipped: boolean;
  message: string;
};

export type FailedPollInfo = {
  oltId: string;
  oltName: string;
  message: string;
  failedAt: string;
};

export type SuccessfulPollInfo = {
  oltId: string;
  oltName: string;
  onuCount?: number;
  onlineCount?: number;
  polledAt: string;
};

export type StartupStatus = {
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

export type OltForm = {
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

export type SignalTone = "good" | "warning" | "critical" | "empty";

export const legacyStorageKey = "mikroin-monitor-state-v2";

export const emptyState: MonitoringState = {
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

export const emptyForm: OltForm = {
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

export const panelClass =
  "rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur";
export const tableShellClass =
  "mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/60";
export const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";
export const secondaryButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
export const cyanButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50";
