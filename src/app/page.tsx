import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function Home() {
  return (
    <AppShell>
      <MonitoringWorkspace view="dashboard" />
    </AppShell>
  )
}
