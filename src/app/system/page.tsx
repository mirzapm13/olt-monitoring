import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function SystemPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="system" />
    </AppShell>
  )
}
