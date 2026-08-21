import React, { useEffect, useState } from "react";
import { Plus, Timer, Clock } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PeriodFilter, defaultPeriod } from "../../components/ui/PeriodFilter";
import type { Period } from "../../components/ui/PeriodFilter";
import { AppMultiLineChart, AppBarChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { ImportButton } from "../../components/ui/ImportButton";
import { formatDate, label as labelFor, todayStr, exportCsv } from "../../lib/format";

interface ServiceTimeRecord {
  id: number;
  record_date: string;
  unit: string;
  shift: string | null;
  avg_wait_minutes: number;
  avg_service_minutes: number;
  observation: string | null;
  created_at: string;
}

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const SHIFTS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

const emptyForm = { record_date: todayStr(), unit: UNITS[0], shift: "manha", avg_wait_minutes: 0, avg_service_minutes: 0, observation: "" };

export default function SerecServiceTimes() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: ServiceTimeRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceTimeRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceTimeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refreshing, lastUpdated, refresh } = usePolling(
    async () => {
      const res = await api.get("/serec/service-times/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        avgWait: number;
        avgService: number;
        daily: { date: string; avgWait: number; avgService: number }[];
        byUnit: { unit: string; avgWait: number; avgService: number }[];
      };
    },
    [period.from, period.to]
  );

  usePageHeader({ title: "SEREC · Tempo de Atendimento", lastUpdated, onRefresh: refresh, refreshing });

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/serec/service-times", { params: { search, page, pageSize: 10, sort: "record_date", order: "desc" } });
      setRows(res.data);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: ServiceTimeRecord) => {
    setEditing(row);
    setForm({
      record_date: row.record_date,
      unit: row.unit,
      shift: row.shift || "manha",
      avg_wait_minutes: row.avg_wait_minutes,
      avg_service_minutes: row.avg_service_minutes,
      observation: row.observation || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/serec/service-times/${editing.id}`, form);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/serec/service-times", form);
        notify("Lançamento registrado com sucesso.");
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
      await api.delete(`/serec/service-times/${deleteTarget.id}`);
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

  const columns: Column<ServiceTimeRecord>[] = [
    { key: "record_date", header: "Data", render: (r) => formatDate(r.record_date) },
    { key: "unit", header: "Unidade" },
    { key: "shift", header: "Turno", render: (r) => labelFor(r.shift) },
    { key: "avg_wait_minutes", header: "Tempo médio de espera (min)" },
    { key: "avg_service_minutes", header: "Tempo médio de atendimento (min)" },
    { key: "observation", header: "Observação", render: (r) => r.observation || "-" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {hasRole("administrador", "gestor", "operacional") && (
          <div className="flex gap-2">
            <ImportButton resource="serec_service_times" onDone={() => { loadTable(); refresh(); }} />
            <Button onClick={openCreate}>
              <Plus size={16} /> Novo lançamento
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Tempo médio de espera" value={summaryLoading ? "…" : `${summary?.avgWait ?? 0} min`} icon={Clock} />
        <KpiCard label="Tempo médio de atendimento" value={summaryLoading ? "…" : `${summary?.avgService ?? 0} min`} icon={Timer} />
      </div>

      <Card title="Evolução diária dos dois sub-indicadores">
        <AppMultiLineChart
          data={summary?.daily || []}
          lines={[
            { dataKey: "avgWait", label: "Tempo médio de espera (min)" },
            { dataKey: "avgService", label: "Tempo médio de atendimento (min)" },
          ]}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Tempo médio de espera por unidade">
          <AppBarChart data={summary?.byUnit || []} dataKey="avgWait" xKey="unit" formatXLabel={(v) => v} />
        </Card>
        <Card title="Tempo médio de atendimento por unidade">
          <AppBarChart data={summary?.byUnit || []} dataKey="avgService" xKey="unit" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Lançamentos" subtitle="Histórico de tempo de atendimento da recepção">
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows.data}
            total={rows.total}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onEdit={hasRole("administrador", "gestor", "operacional") ? openEdit : undefined}
            onDelete={hasRole("administrador") ? (r) => setDeleteTarget(r) : undefined}
            onExport={() => exportCsv("serec_tempo_atendimento.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar lançamento" : "Novo lançamento — Tempo de Atendimento"}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" required value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </Field>
            <Field label="Unidade" required>
              <Select required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Turno">
            <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
              {SHIFTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tempo médio de espera (min)" required>
              <Input
                type="number"
                min={0}
                step="0.1"
                required
                value={form.avg_wait_minutes}
                onChange={(e) => setForm({ ...form, avg_wait_minutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tempo médio de atendimento (min)" required>
              <Input
                type="number"
                min={0}
                step="0.1"
                required
                value={form.avg_service_minutes}
                onChange={(e) => setForm({ ...form, avg_service_minutes: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Observação">
            <Textarea rows={2} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} />
          </Field>
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
        message={`Tem certeza que deseja excluir o lançamento de ${deleteTarget ? formatDate(deleteTarget.record_date) : ""}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
