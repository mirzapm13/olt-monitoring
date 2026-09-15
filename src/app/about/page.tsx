import { AppShell } from "@/components/app-shell"
import { MonitoringWorkspace } from "@/components/monitoring-workspace"

export default function AboutPage() {
  return (
    <AppShell>
      <MonitoringWorkspace view="about" />
    </AppShell>
  )
}
