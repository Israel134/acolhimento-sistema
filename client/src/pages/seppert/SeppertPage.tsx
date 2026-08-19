import React, { useEffect, useMemo, useState } from "react";
import { Boxes, PackageOpen, PackageCheck, Percent } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { AppBarChart, AppPieChart } from "../../components/charts/Charts";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Textarea } from "../../components/ui/Form";
import { formatDate } from "../../lib/format";

interface Locker {
  id: number;
  unit: string;
  armario: number;
  fileira: number;
  posicao: number;
  status: string;
  patient_name: string | null;
  entry_date: string | null;
  exit_date: string | null;
  description: string | null;
}

interface Summary {
  total: number;
  ocupado: number;
  livre: number;
  occupancyRate: number;
  byUnit: { unit: string; total: number; ocupado: number; livre: number }[];
  byArmario: { unit: string; armario: number; total: number; ocupado: number }[];
  statusChart: { status: string; c: number }[];
}

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const ARMARIOS = [1, 2, 3, 4];

export default function SeppertPage() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const canWrite = hasRole("administrador", "gestor", "operacional");

  const [unit, setUnit] = useState(UNITS[0]);
  const [armario, setArmario] = useState(1);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [gridLoading, setGridLoading] = useState(true);

  const [selected, setSelected] = useState<Locker | null>(null);
  const [form, setForm] = useState<{ patient_name: string; entry_date: string; description: string }>({
    patient_name: "",
    entry_date: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [freeTarget, setFreeTarget] = useState<Locker | null>(null);
  const [freeing, setFreeing] = useState(false);

  const { data: summary, refreshing, lastUpdated, refresh } = usePolling<Summary>(
    async () => {
      const res = await api.get("/seppert/lockers/agg/summary");
      return res.data;
    },
    []
  );

  usePageHeader({ title: "SEPPERT · Central de Pertences", lastUpdated, onRefresh: refresh, refreshing });

  const loadGrid = async () => {
    setGridLoading(true);
    try {
      const res = await api.get("/seppert/lockers", { params: { unit, armario } });
      setLockers(res.data.data);
    } finally {
      setGridLoading(false);
    }
  };

  useEffect(() => {
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, armario]);

  const fileiras = useMemo(() => {
    const map: Record<number, Locker[]> = {};
    lockers.forEach((l) => {
      if (!map[l.fileira]) map[l.fileira] = [];
      map[l.fileira].push(l);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.posicao - b.posicao));
    return Object.entries(map)
      .map(([f, items]) => ({ fileira: Number(f), items }))
      .sort((a, b) => a.fileira - b.fileira);
  }, [lockers]);

  const openPosition = (l: Locker) => {
    if (!canWrite) {
      // usuários sem permissão de escrita ainda podem ver os detalhes
      setSelected(l);
      setForm({ patient_name: l.patient_name || "", entry_date: l.entry_date || "", description: l.description || "" });
      return;
    }
    setSelected(l);
    setForm({ patient_name: l.patient_name || "", entry_date: l.entry_date || "", description: l.description || "" });
  };

  const handleOccupy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!form.patient_name.trim()) {
      notify("Informe o nome do paciente.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/seppert/lockers/${selected.id}/ocupar`, form);
      notify(selected.status === "ocupado" ? "Posição atualizada." : "Posição ocupada com sucesso.");
      setSelected(null);
      loadGrid();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFree = async () => {
    if (!freeTarget) return;
    setFreeing(true);
    try {
      await api.put(`/seppert/lockers/${freeTarget.id}/liberar`, {});
      notify("Posição liberada com sucesso.");
      setFreeTarget(null);
      setSelected(null);
      loadGrid();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setFreeing(false);
    }
  };

  const armarioChartData = (summary?.byArmario || [])
    .filter((a) => a.unit === unit)
    .map((a) => ({ armario: `Armário ${a.armario}`, total: a.ocupado }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de posições" value={summary?.total ?? "…"} icon={Boxes} />
        <KpiCard label="Ocupadas" value={summary?.ocupado ?? "…"} icon={PackageCheck} accent="var(--status-critical)" />
        <KpiCard label="Livres" value={summary?.livre ?? "…"} icon={PackageOpen} accent="var(--status-good)" />
        <KpiCard label="Taxa de ocupação" value={summary ? `${summary.occupancyRate}%` : "…"} icon={Percent} accent="var(--brand-4)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Ocupação por unidade" subtitle="Posições ocupadas vs. livres" className="lg:col-span-2">
          <AppBarChart
            data={summary?.byUnit || []}
            dataKey="ocupado"
            xKey="unit"
            formatXLabel={(v) => v}
            colorByIndex={false}
          />
        </Card>
        <Card title="Situação geral">
          <AppPieChart data={summary?.statusChart || []} dataKey="c" nameKey="status" donut={false} />
        </Card>
      </div>

      <Card title="Mapa de armários" subtitle="Selecione a unidade e o armário. Clique em uma posição para ocupar, editar ou liberar.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    unit === u
                      ? "bg-[var(--brand-1)] text-white border-[var(--brand-1)]"
                      : "border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ARMARIOS.map((a) => (
                <button
                  key={a}
                  onClick={() => setArmario(a)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    armario === a
                      ? "bg-[var(--brand-7)] text-white border-[var(--brand-7)]"
                      : "border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                  }`}
                >
                  Armário {a}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "var(--status-good)" }} /> Livre
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "var(--status-critical)" }} /> Ocupado
              </span>
            </div>
          </div>

          {gridLoading ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando posições...</p>
          ) : (
            <div className="space-y-2 overflow-x-auto scrollbar-thin">
              {fileiras.map(({ fileira, items }) => (
                <div key={fileira} className="flex items-center gap-2 min-w-max">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] w-16 shrink-0">Fileira {fileira}</span>
                  <div className="flex gap-1.5">
                    {items.map((l) => {
                      const occupied = l.status === "ocupado";
                      return (
                        <button
                          key={l.id}
                          onClick={() => openPosition(l)}
                          title={occupied ? `Posição ${l.posicao} — ${l.patient_name}` : `Posição ${l.posicao} — livre`}
                          className="w-9 h-9 rounded-md text-[11px] font-semibold text-white flex items-center justify-center transition-transform hover:scale-105"
                          style={{ backgroundColor: occupied ? "var(--status-critical)" : "var(--status-good)" }}
                        >
                          {l.posicao}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Ocupação por armário" subtitle={`Posições ocupadas em cada armário — ${unit}`}>
        <AppBarChart data={armarioChartData} dataKey="total" xKey="armario" formatXLabel={(v) => v} />
      </Card>

      {/* Modal de posição */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selected.unit} · Armário ${selected.armario} · Fileira ${selected.fileira} · Posição ${selected.posicao}`
            : ""
        }
      >
        {selected && (
          <form onSubmit={handleOccupy} className="space-y-3">
            {selected.status === "ocupado" && (
              <div className="rounded-lg bg-[var(--surface-1)] p-3 text-xs text-[var(--text-secondary)]">
                Posição atualmente <strong className="text-[var(--status-critical)]">ocupada</strong>
                {selected.entry_date ? ` desde ${formatDate(selected.entry_date)}` : ""}.
              </div>
            )}
            <Field label="Nome do paciente" required>
              <Input
                required
                disabled={!canWrite}
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                placeholder="Nome completo do paciente"
              />
            </Field>
            <Field label="Data de entrada">
              <Input
                type="date"
                disabled={!canWrite}
                value={form.entry_date || ""}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              />
            </Field>
            <Field label="Descrição dos pertences">
              <Textarea
                rows={3}
                disabled={!canWrite}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: 1 mochila, documentos, celular..."
              />
            </Field>
            {canWrite && (
              <div className="flex justify-between gap-2 pt-2">
                {selected.status === "ocupado" ? (
                  <Button type="button" variant="secondary" onClick={() => setFreeTarget(selected)}>
                    Liberar posição
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : selected.status === "ocupado" ? "Salvar alterações" : "Ocupar posição"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!freeTarget}
        onClose={() => setFreeTarget(null)}
        onConfirm={handleFree}
        loading={freeing}
        danger={false}
        confirmLabel="Liberar"
        title="Liberar posição"
        message={
          freeTarget
            ? `Confirma a liberação da posição ${freeTarget.posicao} (Armário ${freeTarget.armario}, Fileira ${freeTarget.fileira})? Os dados do paciente atual serão removidos e a saída será registrada.`
            : ""
        }
      />
    </div>
  );
}
