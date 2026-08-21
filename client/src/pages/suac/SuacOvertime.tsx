import React, { useEffect, useState } from "react";
import { Plus, Clock } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PeriodFilter, defaultPeriod } from "../../components/ui/PeriodFilter";
import type { Period } from "../../components/ui/PeriodFilter";
import { AppBarChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { ImportButton } from "../../components/ui/ImportButton";
import { formatDate, formatMonth, todayStr, exportCsv } from "../../lib/format";

interface OTRecord {
  id: number;
  record_date: string;
  sector: string;
  unit: string | null;
  manager_id: number | null;
  hours: number;
  observation: string | null;
}

const SECTORS = ["SEREC", "SETIP"];
const UNITS = ["IMDL", "HPS 28 de Agosto"];

const emptyForm = { record_date: todayStr(), sector: "SEREC", unit: UNITS[0], manager_id: "", hours: 1, observation: "" };

export function SuacOvertime() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const canWrite = hasRole("administrador", "gestor");
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: OTRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OTRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OTRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refresh } = usePolling(
    async () => {
      const res = await api.get("/suac/overtime/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        total: number; totalSerec: number; totalSetip: number;
        bySector: { sector: string; h: number }[];
        monthly: { month: string; h: number }[];
        weekly: { week: string; h: number }[];
        byManager: { manager: string; h: number }[];
      };
    },
    [period.from, period.to]
  );

  useEffect(() => {
    api.get("/managers", { params: { pageSize: 200, sort: "name", order: "asc" } }).then((r) => setManagers(r.data.data)).catch(() => {});
  }, []);

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/suac/overtime", { params: { search, page, pageSize: 10, sort: "record_date", order: "desc" } });
      setRows(res.data);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const managerName = (id: number | null) => managers.find((m) => m.id === id)?.name || (id ? `#${id}` : "-");

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, manager_id: managers[0]?.id || "" });
    setModalOpen(true);
  };

  const openEdit = (row: OTRecord) => {
    setEditing(row);
    setForm({ record_date: row.record_date, sector: row.sector, unit: row.unit || UNITS[0], manager_id: row.manager_id ?? "", hours: row.hours, observation: row.observation || "" });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, manager_id: form.manager_id ? Number(form.manager_id) : null, hours: Number(form.hours) };
      if (editing) {
        await api.put(`/suac/overtime/${editing.id}`, payload);
        notify("Registro atualizado com sucesso.");
      } else {
        await api.post("/suac/overtime", payload);
        notify("Horas extras registradas com sucesso.");
      }
      setModalOpen(false);
      loadTable();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/suac/overtime/${deleteTarget.id}`);
      notify("Registro excluído com sucesso.");
      setDeleteTarget(null);
      loadTable();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<OTRecord>[] = [
    { key: "record_date", header: "Data", render: (r) => formatDate(r.record_date) },
    { key: "sector", header: "Setor" },
    { key: "unit", header: "Unidade", render: (r) => r.unit || "-" },
    { key: "manager_id", header: "Gestor", render: (r) => managerName(r.manager_id) },
    { key: "hours", header: "Horas", render: (r) => `${r.hours}h` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {canWrite && (
          <div className="flex gap-2">
            <ImportButton resource="overtime" onDone={() => { loadTable(); refresh(); }} />
            <Button onClick={openCreate}>
              <Plus size={16} /> Lançar horas extras
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <KpiCard label="Total de horas extras" value={summaryLoading ? "…" : `${summary?.total ?? 0}h`} icon={Clock} />
        <KpiCard label="Total SEREC" value={summaryLoading ? "…" : `${summary?.totalSerec ?? 0}h`} accent="var(--brand-1)" />
        <KpiCard label="Total SETIP" value={summaryLoading ? "…" : `${summary?.totalSetip ?? 0}h`} accent="var(--brand-5)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Evolução mensal" subtitle="Horas extras por mês">
          <AppBarChart data={summary?.monthly || []} dataKey="h" xKey="month" formatXLabel={formatMonth} colorByIndex={false} />
        </Card>
        <Card title="Comparativo semanal">
          <AppBarChart data={summary?.weekly || []} dataKey="h" xKey="week" formatXLabel={(v) => v.replace(/^\d{4}-/, "")} colorByIndex={false} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Comparativo entre setores">
          <AppBarChart data={summary?.bySector || []} dataKey="h" xKey="sector" formatXLabel={(v) => v} />
        </Card>
        <Card title="Ranking por gestor">
          <AppBarChart data={summary?.byManager || []} dataKey="h" xKey="manager" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Lançamentos" subtitle="Histórico de horas extras">
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows.data}
            total={rows.total}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onEdit={canWrite ? openEdit : undefined}
            onDelete={hasRole("administrador") ? (r) => setDeleteTarget(r) : undefined}
            onExport={() => exportCsv("suac_horas_extras.csv", rows.data.map((r) => ({ ...r, manager: managerName(r.manager_id) })))}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar lançamento" : "Novo lançamento — Horas Extras"}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" required value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </Field>
            <Field label="Setor" required>
              <Select required value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidade">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Quantidade de horas" required>
              <Input type="number" min={0} step="0.5" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Gestor">
            <Select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">Selecione...</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Observação">
            <Textarea rows={2} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} />
          </Field>
          <p className="text-[11px] text-[var(--text-muted)]">
            Dica: para lançamento retroativo (semanal, mensal ou de meses anteriores), basta escolher a data do período desejado.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="Tem certeza que deseja excluir este lançamento de horas extras? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
