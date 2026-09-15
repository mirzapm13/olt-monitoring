import { execFile } from "node:child_process"
import { access, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const startupName = "Mikroin Monitor"
const cmdFileName = "mikroin-monitor-start.cmd"
const vbsFileName = "mikroin-monitor-start.vbs"
const linuxServiceName = "mikroin-monitor.service"
const appPort = "3007"
const execFileAsync = promisify(execFile)

function currentPlatform() {
  if (process.platform === "win32") return "windows"
  if (process.platform === "linux") return "linux"
  if (process.platform === "darwin") return "macos"
  return process.platform
}

function startupDir() {
  const appData = process.env.APPDATA
  if (!appData) throw new Error("Folder APPDATA Windows tidak ditemukan.")

  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
}

function startupFiles() {
  const dir = startupDir()

  return {
    dir,
    cmdPath: path.join(dir, cmdFileName),
    vbsPath: path.join(dir, vbsFileName),
  }
}

function psQuote(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function exists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function isLinuxServiceEnabled() {
  try {
    const result = await execFileAsync("systemctl", ["is-enabled", linuxServiceName])
    return result.stdout.trim() === "enabled"
  } catch {
    return false
  }
}

function requireLinuxRoot(action: string) {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    throw new Error(`${action} otomatis di Linux perlu akses root. Jalankan Mikroin Monitor dengan root/sudo, atau gunakan command systemd manual di bawah.`)
  }
}

export async function getStartupStatus() {
  const platform = currentPlatform()
  if (platform !== "windows") {
    const linuxGuide = platform === "linux" ? linuxSystemdGuide() : null
    const linuxEnabled = platform === "linux" ? await isLinuxServiceEnabled() : false

    return {
      enabled: linuxEnabled,
      label: startupName,
      platform,
      path: linuxGuide?.servicePath ?? "",
      supported: platform === "linux" ? "manual" : "unsupported",
      linux: linuxGuide,
    }
  }

  const files = startupFiles()
  const enabled = (await exists(files.vbsPath)) && (await exists(files.cmdPath))

  return {
    enabled,
    label: startupName,
    platform,
    supported: "automatic",
    path: files.vbsPath,
    linux: null,
  }
}

export async function enableStartup() {
  const platform = currentPlatform()

  if (platform === "linux") {
    return enableLinuxStartup()
  }

  if (platform !== "windows") {
    throw new Error("Aktif/nonaktif otomatis dari UI belum tersedia untuk platform ini. Gunakan service manager bawaan OS.")
  }

  const files = startupFiles()
  const projectDir = process.cwd()
  const powerShellCommand = [
    "$running = $false",
    "try {",
    `  $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:${appPort}' -TimeoutSec 3`,
    "  $running = $response.StatusCode -ge 200",
    "} catch {",
    "  $running = $false",
    "}",
    "if (-not $running) {",
    `  Start-Process -FilePath 'npx.cmd' -ArgumentList 'next','dev','--webpack','--hostname','127.0.0.1','--port','${appPort}' -WorkingDirectory ${psQuote(projectDir)} -WindowStyle Hidden`,
    "}",
  ].join("; ")
  const cmdContent = [
    "@echo off",
    "REM Auto-start Mikroin Monitor local server.",
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "${powerShellCommand.replaceAll('"', '\\"')}"`,
    "",
  ].join("\r\n")
  const vbsContent = [
    "Set shell = CreateObject(\"WScript.Shell\")",
    `shell.Run Chr(34) & "${files.cmdPath.replaceAll('"', '""')}" & Chr(34), 0, False`,
    "",
  ].join("\r\n")

  await mkdir(files.dir, { recursive: true })
  await writeFile(files.cmdPath, cmdContent, "utf8")
  await writeFile(files.vbsPath, vbsContent, "utf8")

  return getStartupStatus()
}

export async function disableStartup() {
  const platform = currentPlatform()

  if (platform === "linux") {
    return disableLinuxStartup()
  }

  if (platform !== "windows") {
    throw new Error("Aktif/nonaktif otomatis dari UI belum tersedia untuk platform ini. Gunakan service manager bawaan OS.")
  }

  const files = startupFiles()
  await rm(files.cmdPath, { force: true })
  await rm(files.vbsPath, { force: true })

  return getStartupStatus()
}

async function enableLinuxStartup() {
  requireLinuxRoot("Install startup")

  const guide = linuxSystemdGuide()
  await writeFile(guide.servicePath, `${guide.service}\n`, "utf8")
  await execFileAsync("systemctl", ["daemon-reload"])
  await execFileAsync("systemctl", ["enable", linuxServiceName])
  await execFileAsync("systemctl", ["start", linuxServiceName])

  return getStartupStatus()
}

async function disableLinuxStartup() {
  requireLinuxRoot("Nonaktifkan startup")

  await execFileAsync("systemctl", ["disable", linuxServiceName])
  await rm(`/etc/systemd/system/${linuxServiceName}`, { force: true })
  await execFileAsync("systemctl", ["daemon-reload"])

  return getStartupStatus()
}

function linuxSystemdGuide() {
  const projectDir = process.cwd().replaceAll("\\", "/")
  const service = [
    "[Unit]",
    "Description=Mikroin Monitor",
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `WorkingDirectory=${projectDir}`,
    `ExecStart=/usr/bin/npm run start -- --hostname 0.0.0.0 --port ${appPort}`,
    "Restart=always",
    "RestartSec=5",
    "Environment=NODE_ENV=production",
    `Environment=PORT=${appPort}`,
    "",
    "[Install]",
    "WantedBy=multi-user.target",
  ].join("\n")

  return {
    serviceName: linuxServiceName,
    servicePath: `/etc/systemd/system/${linuxServiceName}`,
    service,
    commands: [
      "npm run build",
      `sudo tee /etc/systemd/system/${linuxServiceName} > /dev/null <<'EOF'\n${service}\nEOF`,
      "sudo systemctl daemon-reload",
      `sudo systemctl enable ${linuxServiceName}`,
      `sudo systemctl start ${linuxServiceName}`,
      `sudo systemctl status ${linuxServiceName}`,
    ],
    disableCommands: [`sudo systemctl stop ${linuxServiceName}`, `sudo systemctl disable ${linuxServiceName}`],
  }
}
