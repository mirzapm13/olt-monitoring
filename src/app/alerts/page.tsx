import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function AlertsPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="alerts" />
    </AppShell>
  )
}
