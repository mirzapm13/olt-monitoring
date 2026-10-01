export type OidProfileKey =
  | "generic"
  | "vsol-gpon"
  | "vsol-epon"
  | "vsol-epon-v16004dl"
  | "vsol-epon-v1600d8"
  | "hsgq-gpon"
  | "hsgq-epon"
  | "hioso-epon"

export type OidItem = {
  key: string
  label: string
  oid: string
  kind: "system" | "ont" | "optical" | "interface"
}

export type OidProfile = {
  key: OidProfileKey
  name: string
  enterpriseRoot?: string
  items: OidItem[]
}

const systemItems: OidItem[] = [
  { key: "sysDescr", label: "System description", oid: "1.3.6.1.2.1.1.1.0", kind: "system" },
  { key: "sysObjectId", label: "System object ID", oid: "1.3.6.1.2.1.1.2.0", kind: "system" },
  { key: "sysUpTime", label: "System uptime", oid: "1.3.6.1.2.1.1.3.0", kind: "system" },
  { key: "sysName", label: "System name", oid: "1.3.6.1.2.1.1.5.0", kind: "system" },
  { key: "sysLocation", label: "System location", oid: "1.3.6.1.2.1.1.6.0", kind: "system" },
]

const interfaceItems: OidItem[] = [
  { key: "ifDescr", label: "Interface description", oid: "1.3.6.1.2.1.2.2.1.2", kind: "interface" },
  { key: "ifOperStatus", label: "Interface operational status", oid: "1.3.6.1.2.1.2.2.1.8", kind: "interface" },
]

const vsolEponV16004dlItems: OidItem[] = [
  ...systemItems,
  { key: "productModel", label: "Product model", oid: "1.3.6.1.4.1.37950.1.1.5.10.14.1.0", kind: "system" },
  { key: "firmwareVersion", label: "Firmware version", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.4.0", kind: "system" },
  { key: "hardwareVersion", label: "Hardware version", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.5.0", kind: "system" },
  { key: "serialNumber", label: "OLT serial number", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0", kind: "system" },
  { key: "runState", label: "ONT run state", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.4", kind: "ont" },
  { key: "mac", label: "ONT MAC address", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.5", kind: "ont" },
  { key: "vendorId", label: "ONT vendor ID", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.3", kind: "ont" },
  { key: "model", label: "ONT model ID", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.4", kind: "ont" },
  { key: "ontName", label: "ONT description", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.9", kind: "ont" },
  { key: "rttTq", label: "ONT RTT (TQ)", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.12", kind: "ont" },
  { key: "distance", label: "ONT distance", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.17", kind: "ont" },
  { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.3", kind: "optical" },
  { key: "txPower", label: "ONT TX power", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.6", kind: "optical" },
  { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7", kind: "optical" },
  ...interfaceItems,
]

const vsolEponV1600d8Items: OidItem[] = [
  ...systemItems,
  { key: "productModel", label: "Product model", oid: "1.3.6.1.4.1.37950.1.1.5.10.14.1.0", kind: "system" },
  { key: "firmwareVersion", label: "Firmware version", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.4.0", kind: "system" },
  { key: "hardwareVersion", label: "Hardware version", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.5.0", kind: "system" },
  { key: "serialNumber", label: "OLT serial number", oid: "1.3.6.1.4.1.37950.1.1.5.10.12.5.11.0", kind: "system" },
  { key: "runState", label: "ONT run state", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.4", kind: "ont" },
  { key: "mac", label: "ONT MAC address", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.5", kind: "ont" },
  { key: "vendorId", label: "ONT vendor ID", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.3", kind: "ont" },
  { key: "model", label: "ONT model ID", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.4", kind: "ont" },
  { key: "ontName", label: "ONT description", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.9", kind: "ont" },
  { key: "rttTq", label: "ONT RTT (TQ)", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.12", kind: "ont" },
  { key: "distance", label: "ONT distance", oid: "1.3.6.1.4.1.37950.1.1.5.12.1.25.1.17", kind: "ont" },
  { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.13.1.3", kind: "optical" },
  { key: "txPower", label: "ONT TX power", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.13.1.6", kind: "optical" },
  { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.37950.1.1.5.12.2.1.13.1.7", kind: "optical" },
  ...interfaceItems,
]

export const oidProfiles: OidProfile[] = [
  {
    key: "generic",
    name: "Generic SNMP",
    items: [...systemItems, ...interfaceItems],
  },
  {
    key: "vsol-gpon",
    name: "VSOL GPON",
    enterpriseRoot: "1.3.6.1.4.1.37950",
    items: [
      ...systemItems,
      { key: "productModel", label: "Product model", oid: "1.3.6.1.4.1.37950.1.1.5.10.14.1.0", kind: "system" },
      { key: "typeVersion", label: "Type version", oid: "1.3.6.1.4.1.37950.1.1.5.10.14.5.0", kind: "system" },
      { key: "productType", label: "Product type", oid: "1.3.6.1.4.1.37950.1.1.5.10.14.6.0", kind: "system" },
      { key: "statusCode", label: "ONT status code", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.5", kind: "ont" },
      { key: "lastUp", label: "ONT last up", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.8", kind: "ont" },
      { key: "lastDown", label: "ONT last down", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.9", kind: "ont" },
      { key: "lastDownReason", label: "ONT last down reason", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.1.1.10", kind: "ont" },
      { key: "serial", label: "ONT serial", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.2.1.5", kind: "ont" },
      { key: "model", label: "ONT model", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.2.1.6", kind: "ont" },
      { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.3.1.3", kind: "optical" },
      { key: "txPower", label: "ONT TX power", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.3.1.6", kind: "optical" },
      { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.37950.1.1.6.1.1.3.1.7", kind: "optical" },
      ...interfaceItems,
    ],
  },
  {
    key: "vsol-epon",
    name: "VSOL EPON (Generic)",
    enterpriseRoot: "1.3.6.1.4.1.37950",
    items: vsolEponV1600d8Items,
  },
  {
    key: "vsol-epon-v16004dl",
    name: "VSOL EPON V16004DL",
    enterpriseRoot: "1.3.6.1.4.1.37950",
    items: vsolEponV16004dlItems,
  },
  {
    key: "vsol-epon-v1600d8",
    name: "VSOL EPON V1600D8",
    enterpriseRoot: "1.3.6.1.4.1.37950",
    items: vsolEponV1600d8Items,
  },
  {
    key: "hioso-epon",
    name: "HiOSO EPON",
    enterpriseRoot: "1.3.6.1.4.1.25355",
    items: [
      ...systemItems,
      { key: "deviceInfo", label: "Device Info", oid: "1.3.6.1.4.1.25355.3.1.8.1.1.2.1", kind: "system" },
      { key: "ontName", label: "ONT name", oid: "1.3.6.1.4.1.25355.3.2.6.3.2.1.37", kind: "ont" },
      { key: "mac", label: "ONT MAC address", oid: "1.3.6.1.4.1.25355.3.2.6.3.2.1.11", kind: "ont" },
      { key: "runState", label: "ONT run state", oid: "1.3.6.1.4.1.25355.3.2.6.3.2.1.39", kind: "ont" },
      { key: "distance", label: "ONT distance", oid: "1.3.6.1.4.1.25355.3.2.6.3.2.1.25", kind: "ont" },
      { key: "txPower", label: "ONT TX power", oid: "1.3.6.1.4.1.25355.3.2.6.14.2.1.4", kind: "optical" },
      { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.25355.3.2.6.14.2.1.8", kind: "optical" },
      { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.25355.3.2.6.14.2.1.7", kind: "optical" },
      ...interfaceItems,
    ],
  },
  {
    key: "hsgq-gpon",
    name: "HSGQ GPON",
    enterpriseRoot: "1.3.6.1.4.1.50224",
    items: [
      ...systemItems,
      { key: "firmwareVersion", label: "Firmware version", oid: "1.3.6.1.4.1.50224.3.1.1.6.0", kind: "system" },
      { key: "productModel", label: "Product model", oid: "1.3.6.1.4.1.50224.3.1.1.19.0", kind: "system" },
      { key: "ontName", label: "ONT name", oid: "1.3.6.1.4.1.50224.3.12.2.1.2", kind: "ont" },
      { key: "runState", label: "ONT run state", oid: "1.3.6.1.4.1.50224.3.12.2.1.4", kind: "ont" },
      { key: "serial", label: "ONT serial", oid: "1.3.6.1.4.1.50224.3.12.2.1.15", kind: "ont" },
      { key: "lastDownReason", label: "ONT last down reason", oid: "1.3.6.1.4.1.50224.3.12.2.1.22", kind: "ont" },
      { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.50224.3.12.3.1.4", kind: "optical" },
      { key: "txPower", label: "ONT TX power", oid: "1.3.6.1.4.1.50224.3.12.3.1.5", kind: "optical" },
      { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.50224.3.12.3.1.8", kind: "optical" },
      ...interfaceItems,
    ],
  },
  {
    key: "hsgq-epon",
    name: "HSGQ EPON",
    enterpriseRoot: "1.3.6.1.4.1.50224",
    items: [
      ...systemItems,
      { key: "firmwareVersion", label: "Firmware version", oid: "1.3.6.1.4.1.50224.3.1.1.6.0", kind: "system" },
      { key: "productModel", label: "Product model", oid: "1.3.6.1.4.1.50224.3.1.1.19.0", kind: "system" },
      { key: "ontName", label: "ONT name", oid: "1.3.6.1.4.1.50224.3.3.2.1.2", kind: "ont" },
      { key: "runState", label: "ONT run state", oid: "1.3.6.1.4.1.50224.3.3.2.1.8", kind: "ont" },
      { key: "serial", label: "ONT serial", oid: "1.3.6.1.4.1.50224.3.3.2.1.7", kind: "ont" },
      { key: "lastDownReason", label: "ONT last down reason", oid: "1.3.6.1.4.1.50224.3.3.2.1.31", kind: "ont" },
      { key: "rxPower", label: "ONT RX power", oid: "1.3.6.1.4.1.50224.3.3.3.1.4", kind: "optical" },
      { key: "temperature", label: "ONT temperature", oid: "1.3.6.1.4.1.50224.3.3.3.1.8", kind: "optical" },
      ...interfaceItems,
    ],
  },
]

export function getOidProfile(key: OidProfileKey) {
  return oidProfiles.find((profile) => profile.key === key) ?? oidProfiles[0]
}
