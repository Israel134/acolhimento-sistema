import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PeriodFilter, defaultPeriod } from "../../components/ui/PeriodFilter";
import type { Period } from "../../components/ui/PeriodFilter";
import { AppLineChart, AppBarChart, AppPieChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { formatDate, label as labelFor, todayStr } from "../../lib/format";
import { exportCsv } from "../../lib/format";
import { Activity } from "lucide-react";

interface PatientRecord {
  id: number;
  record_date: string;
  unit: string;
  category: string;
  quantity: number;
  observation: string | null;
  created_at: string;
}

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const CATEGORIES = [
  { value: "urgencia", label: "Urgência" },
  { value: "ambulatorio", label: "Ambulatório" },
  { value: "internados", label: "Pacientes internados" },
];

const emptyForm = { record_date: todayStr(), unit: UNITS[0], category: "urgencia", quantity: 1, observation: "" };

export default function SerecPatients() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: PatientRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refreshing, lastUpdated, refresh } = usePolling(
    async () => {
      const res = await api.get("/serec/patients/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        total: number;
        byCategory: { category: string; total: number }[];
        daily: { date: string; total: number }[];
        byUnit: { unit: string; total: number }[];
      };
    },
    [period.from, period.to]
  );

  usePageHeader({ title: "SEREC · Atendimentos", lastUpdated, onRefresh: refresh, refreshing });

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/serec/patients", { params: { search, page, pageSize: 10, sort: "record_date", order: "desc" } });
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

  const openEdit = (row: PatientRecord) => {
    setEditing(row);
    setForm({ record_date: row.record_date, unit: row.unit, category: row.category, quantity: row.quantity, observation: row.observation || "" });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/serec/patients/${editing.id}`, form);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/serec/patients", form);
        notify("Dados cadastrados com sucesso.");
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
      await api.delete(`/serec/patients/${deleteTarget.id}`);
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

  const columns: Column<PatientRecord>[] = [
    { key: "record_date", header: "Data", render: (r) => formatDate(r.record_date) },
    { key: "unit", header: "Unidade" },
    { key: "category", header: "Tipo", render: (r) => labelFor(r.category) },
    { key: "quantity", header: "Quantidade" },
    { key: "observation", header: "Observação", render: (r) => r.observation || "-" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {hasRole("administrador", "gestor", "operacional") && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo lançamento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de pacientes" value={summaryLoading ? "…" : summary?.total ?? 0} icon={Activity} />
        {CATEGORIES.map((c) => (
          <KpiCard
            key={c.value}
            label={c.label}
            value={summaryLoading ? "…" : summary?.byCategory.find((x) => x.category === c.value)?.total ?? 0}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Evolução diária" className="lg:col-span-2">
          <AppLineChart data={summary?.daily || []} />
        </Card>
        <Card title="Distribuição por categoria">
          <AppPieChart data={summary?.byCategory || []} dataKey="total" nameKey="category" />
        </Card>
      </div>

      <Card title="Comparação por unidade">
        <AppBarChart data={summary?.byUnit || []} dataKey="total" xKey="unit" formatXLabel={(v) => v} />
      </Card>

      <Card title="Lançamentos" subtitle="Histórico de atendimentos (permite lançamento retroativo)">
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
            onExport={() => exportCsv("serec_pacientes.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar lançamento" : "Novo lançamento — Atendimentos (retroativo permitido)"}>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de atendimento" required>
              <Select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade" required>
              <Input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
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
