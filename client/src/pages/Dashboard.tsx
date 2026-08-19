import { useState } from "react";
import { Users, HeartHandshake, UserCog, Package, AlertTriangle, Activity } from "lucide-react";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { Card, KpiCard } from "../components/ui/Card";
import { PeriodFilter, defaultPeriod } from "../components/ui/PeriodFilter";
import type { Period } from "../components/ui/PeriodFilter";
import { AppLineChart, AppBarChart, AppPieChart } from "../components/charts/Charts";
import { useAuth } from "../contexts/AuthContext";

interface DashboardSummary {
  cards: {
    totalPatients: number;
    totalFeedbacks: number;
    feedbacksSemAceite: number;
    totalCollaborators: number;
    totalManagers: number;
    assetsTotal: number;
    assetsBroken: number;
  };
  charts: {
    patientsByCategory: { category: string; total: number }[];
    patientsDaily: { date: string; total: number }[];
    feedbacksByStatus: { status: string; c: number }[];
    assetsByStatus: { status: string; c: number }[];
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>(defaultPeriod());

  const { data, loading, refreshing, lastUpdated, refresh } = usePolling<DashboardSummary>(
    async () => {
      const res = await api.get("/dashboard/summary", { params: { from: period.from, to: period.to } });
      return res.data;
    },
    [period.from, period.to]
  );

  usePageHeader({ title: "Dashboard Geral", lastUpdated, onRefresh: refresh, refreshing });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {greeting}, {user?.name?.split(" ")[0]}.
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Atendimentos"
          value={loading ? "…" : data?.cards.totalPatients ?? 0}
          hint="SEREC"
          icon={Activity}
          accent="var(--brand-1)"
        />
        <KpiCard
          label="Feedbacks realizados"
          value={loading ? "…" : data?.cards.totalFeedbacks ?? 0}
          hint={`${data?.cards.feedbacksSemAceite ?? 0} sem aceite`}
          icon={HeartHandshake}
          accent="var(--brand-3)"
        />
        <KpiCard
          label="Colaboradores ativos"
          value={loading ? "…" : data?.cards.totalCollaborators ?? 0}
          icon={Users}
          accent="var(--brand-7)"
        />
        <KpiCard
          label="Gestores ativos"
          value={loading ? "…" : data?.cards.totalManagers ?? 0}
          icon={UserCog}
          accent="var(--brand-5)"
        />
        <KpiCard
          label="Patrimônios cadastrados"
          value={loading ? "…" : data?.cards.assetsTotal ?? 0}
          icon={Package}
          accent="var(--brand-4)"
        />
        <KpiCard
          label="Patrimônios quebrados"
          value={loading ? "…" : data?.cards.assetsBroken ?? 0}
          icon={AlertTriangle}
          accent="var(--status-critical)"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Evolução diária de pacientes atendidos" subtitle="SEREC · período selecionado" className="lg:col-span-2">
          <AppLineChart data={data?.charts.patientsDaily || []} />
        </Card>
        <Card title="Pacientes por categoria" subtitle="SEREC">
          <AppPieChart data={data?.charts.patientsByCategory || []} dataKey="total" nameKey="category" />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Feedbacks por status" subtitle="SUAC · período selecionado">
          <AppBarChart data={data?.charts.feedbacksByStatus || []} dataKey="c" xKey="status" />
        </Card>
        <Card title="Patrimônios por status" subtitle="SUAC · geral">
          <AppPieChart data={data?.charts.assetsByStatus || []} dataKey="c" nameKey="status" donut={false} />
        </Card>
      </div>
    </div>
  );
}
