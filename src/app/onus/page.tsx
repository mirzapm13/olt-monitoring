import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function OnusPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="onus" />
    </AppShell>
  )
}
