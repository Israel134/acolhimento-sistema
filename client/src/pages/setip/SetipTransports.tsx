import React, { useEffect, useState } from "react";
import { Plus, Ambulance } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PeriodFilter, defaultPeriod } from "../../components/ui/PeriodFilter";
import type { Period } from "../../components/ui/PeriodFilter";
import { AppBarChart, AppPieChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { formatDate, formatMonth, label as labelFor, todayStr, exportCsv } from "../../lib/format";

interface TransportRecord {
  id: number;
  record_date: string;
  unit: string;
  collaborator_id: number | null;
  quantity: number;
  transport_type: string | null;
  observation: string | null;
  created_at: string;
}

interface Collaborator {
  id: number;
  name: string;
}

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const TRANSPORT_TYPES = [
  { value: "maca", label: "Maca" },
  { value: "cadeira_rodas", label: "Cadeira de rodas" },
  { value: "leito", label: "Leito" },
  { value: "a_pe", label: "A pé" },
  { value: "outro", label: "Outro" },
];

const emptyForm = { record_date: todayStr(), unit: UNITS[0], collaborator_id: "", quantity: 1, transport_type: "maca", observation: "" };

export default function SetipTransports() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: TransportRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransportRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TransportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refreshing, lastUpdated, refresh } = usePolling(
    async () => {
      const res = await api.get("/setip/transports/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        total: number;
        byMonth: { month: string; total: number }[];
        byCollaborator: { collaborator: string; total: number }[];
        byType: { transport_type: string; total: number }[];
        byUnit: { unit: string; total: number }[];
        daily: { date: string; total: number }[];
      };
    },
    [period.from, period.to]
  );

  usePageHeader({ title: "SETIP · Transporte de Pacientes", lastUpdated, onRefresh: refresh, refreshing });

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/setip/transports", { params: { search, page, pageSize: 10, sort: "record_date", order: "desc" } });
      setRows(res.data);
    } finally {
      setTableLoading(false);
    }
  };

  const loadCollaborators = async () => {
    try {
      const res = await api.get("/collaborators", { params: { pageSize: 200, sort: "name", order: "asc" } });
      setCollaborators(res.data.data);
    } catch {
      // segue sem a lista pré-carregada
    }
  };

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    loadCollaborators();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: TransportRecord) => {
    setEditing(row);
    setForm({
      record_date: row.record_date,
      unit: row.unit,
      collaborator_id: row.collaborator_id ?? "",
      quantity: row.quantity,
      transport_type: row.transport_type || "maca",
      observation: row.observation || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaborator_id) {
      notify("Selecione o colaborador responsável pelo transporte.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, collaborator_id: Number(form.collaborator_id) };
      if (editing) {
        await api.put(`/setip/transports/${editing.id}`, payload);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/setip/transports", payload);
        notify("Transporte registrado com sucesso.");
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
      await api.delete(`/setip/transports/${deleteTarget.id}`);
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

  const collaboratorName = (id: number | null) => collaborators.find((c) => c.id === id)?.name || (id ? `#${id}` : "-");

  const columns: Column<TransportRecord>[] = [
    { key: "record_date", header: "Data", render: (r) => formatDate(r.record_date) },
    { key: "unit", header: "Unidade" },
    { key: "collaborator_id", header: "Colaborador", render: (r) => collaboratorName(r.collaborator_id) },
    { key: "quantity", header: "Pacientes transportados" },
    { key: "transport_type", header: "Tipo", render: (r) => labelFor(r.transport_type) },
    { key: "observation", header: "Observação", render: (r) => r.observation || "-" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {hasRole("administrador", "gestor", "operacional") && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo transporte
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de pacientes transportados" value={summaryLoading ? "…" : summary?.total ?? 0} icon={Ambulance} />
        {UNITS.map((u) => (
          <KpiCard
            key={u}
            label={u}
            value={summaryLoading ? "…" : summary?.byUnit.find((x) => x.unit === u)?.total ?? 0}
          />
        ))}
        <KpiCard
          label="Colaboradores ativos no transporte"
          value={summaryLoading ? "…" : summary?.byCollaborator.length ?? 0}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Pacientes transportados por mês" className="lg:col-span-2">
          <AppBarChart data={summary?.byMonth || []} dataKey="total" xKey="month" formatXLabel={formatMonth} colorByIndex={false} />
        </Card>
        <Card title="Distribuição por tipo de transporte">
          <AppPieChart data={summary?.byType || []} dataKey="total" nameKey="transport_type" />
        </Card>
      </div>

      <Card title="Ranking por colaborador" subtitle="Pacientes transportados por colaborador no período">
        <AppBarChart data={summary?.byCollaborator || []} dataKey="total" xKey="collaborator" formatXLabel={(v) => v} />
      </Card>

      <Card title="Lançamentos" subtitle="Histórico de transporte de pacientes">
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
            onExport={() => exportCsv("setip_transporte.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar transporte" : "Novo transporte de paciente (retroativo permitido)"}>
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
          <Field label="Colaborador responsável" required>
            <Select required value={form.collaborator_id} onChange={(e) => setForm({ ...form, collaborator_id: e.target.value })}>
              <option value="">Selecione o colaborador...</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pacientes transportados" required>
              <Input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Tipo de transporte">
              <Select value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })}>
                {TRANSPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
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
        message={`Tem certeza que deseja excluir o transporte de ${deleteTarget ? formatDate(deleteTarget.record_date) : ""}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
