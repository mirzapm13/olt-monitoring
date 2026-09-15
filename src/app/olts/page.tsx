import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function OltsPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="olts" />
    </AppShell>
  )
}
