export type OltStatus = "online" | "degraded" | "offline"

export type AlertSeverity = "critical" | "warning" | "info"

export type Olt = {
  id: string
  name: string
  ipAddress: string
  vendor: "VSOL" | "HSGQ GPON" | "HSGQ EPON" | "Huawei" | "ZTE" | "FiberHome" | "Other"
  model: string
  location: string
  status: OltStatus
  uptime: string
  cpuLoad: number
  memoryLoad: number
  ponPorts: number
  activeOnu: number
  pollingInterval: number
  snmpVersion: "v1" | "v2c" | "v3"
  snmpPort: number
  readCommunity: string
  writeCommunity?: string
  oidProfile: "vsol-gpon" | "hsgq-gpon" | "hsgq-epon" | "generic"
  writeMode: "none" | "snmp" | "cli" | "api"
  lastSeen: string
  systemInfo?: Record<string, string>
}

export type Onu = {
  id: string
  oltId: string
  name: string
  serialNumber: string
  ponPort: string
  onuIndex: string
  status: "online" | "offline" | "los"
  rxPower: number
  txPower: number
  temperatureC?: number | null
  downReason?: string | null
  distanceMeters: number
  lastSeen: string
  syncStatus: "synced" | "pending" | "failed" | "local-only"
}

export type Alert = {
  id: string
  oltId: string
  title: string
  detail: string
  severity: AlertSeverity
  createdAt: string
  acknowledged: boolean
}

export type RenameOnuRequest = {
  olt: Olt
  onu: Onu
  nextName: string
}

export type RenameOnuResult = {
  ok: boolean
  syncedToDevice: boolean
  message: string
}

export type MonitoringState = {
  olts: Olt[]
  onus: Onu[]
  alerts: Alert[]
  settings: MonitoringSettings
}

export type MonitoringSettings = {
  telegram: TelegramSettings
}

export type TelegramSettings = {
  enabled: boolean
  botToken: string
  chatId: string
  notifyOntDown: boolean
  notifyRecovery: boolean
  botPollingEnabled: boolean
  lastUpdateId: number
}
