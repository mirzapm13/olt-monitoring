import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function SettingsPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="settings" />
    </AppShell>
  )
}
