import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
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
import { Badge } from "../../components/ui/Badge";
import { ImportButton } from "../../components/ui/ImportButton";
import { formatDate, label as labelFor, todayStr, exportCsv } from "../../lib/format";
import { HeartHandshake } from "lucide-react";

interface FeedbackRecord {
  id: number;
  manager_id: number;
  collaborator_id: number;
  feedback_date: string;
  type: string;
  status: string;
  description: string | null;
}

const STATUSES = [
  { value: "aceito", label: "Aceito" },
  { value: "sem_aceite", label: "Sem aceite" },
  { value: "pendente", label: "Pendente" },
];
const TYPES = ["Orientativo", "Reconhecimento", "Avaliativo"];

const emptyForm = { manager_id: "", collaborator_id: "", feedback_date: todayStr(), type: TYPES[0], status: "pendente", description: "" };

export function SuacFeedbacks({ onChanged }: { onChanged?: () => void }) {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: FeedbackRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeedbackRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refresh } = usePolling(
    async () => {
      const res = await api.get("/suac/feedbacks/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as { total: number; byStatus: { status: string; c: number }[]; byManager: { manager: string; c: number }[]; monthly: { month: string; c: number }[]; byType: { type: string; c: number }[] };
    },
    [period.from, period.to]
  );

  useEffect(() => {
    api.get("/managers", { params: { pageSize: 200 } }).then((r) => setManagers(r.data.data));
    api.get("/collaborators", { params: { pageSize: 200 } }).then((r) => setCollaborators(r.data.data));
  }, []);

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/suac/feedbacks", { params: { search, page, pageSize: 10, sort: "feedback_date", order: "desc" } });
      setRows(res.data);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const managerName = (id: number) => managers.find((m) => m.id === id)?.name || `#${id}`;
  const collabName = (id: number) => collaborators.find((c) => c.id === id)?.name || `#${id}`;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, manager_id: managers[0]?.id || "", collaborator_id: collaborators[0]?.id || "" });
    setModalOpen(true);
  };

  const openEdit = (row: FeedbackRecord) => {
    setEditing(row);
    setForm({ manager_id: row.manager_id, collaborator_id: row.collaborator_id, feedback_date: row.feedback_date, type: row.type, status: row.status, description: row.description || "" });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, manager_id: Number(form.manager_id), collaborator_id: Number(form.collaborator_id) };
      if (editing) {
        await api.put(`/suac/feedbacks/${editing.id}`, payload);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/suac/feedbacks", payload);
        notify("Dados cadastrados com sucesso.");
      }
      setModalOpen(false);
      loadTable();
      refresh();
      onChanged?.();
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
      await api.delete(`/suac/feedbacks/${deleteTarget.id}`);
      notify("Registro excluído com sucesso.");
      setDeleteTarget(null);
      loadTable();
      refresh();
      onChanged?.();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<FeedbackRecord>[] = [
    { key: "feedback_date", header: "Data", render: (r) => formatDate(r.feedback_date) },
    { key: "manager", header: "Gestor", render: (r) => managerName(r.manager_id) },
    { key: "collaborator", header: "Colaborador", render: (r) => collabName(r.collaborator_id) },
    { key: "type", header: "Tipo" },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  ];

  const acceptRate = summary && summary.total > 0
    ? Math.round(((summary.byStatus.find((s) => s.status === "aceito")?.c || 0) / summary.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {hasRole("administrador", "gestor") && (
          <div className="flex gap-2">
            <ImportButton resource="feedbacks" onDone={() => { loadTable(); refresh(); }} />
            <Button onClick={openCreate}>
              <Plus size={16} /> Novo lançamento
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Feedbacks realizados" value={summaryLoading ? "…" : summary?.total ?? 0} icon={HeartHandshake} />
        <KpiCard label="Aceitos" value={summaryLoading ? "…" : summary?.byStatus.find((s) => s.status === "aceito")?.c ?? 0} accent="var(--status-good)" />
        <KpiCard label="Sem aceite" value={summaryLoading ? "…" : summary?.byStatus.find((s) => s.status === "sem_aceite")?.c ?? 0} accent="var(--status-critical)" />
        <KpiCard label="% de aceite" value={summaryLoading ? "…" : `${acceptRate}%`} accent="var(--brand-3)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Feedbacks por status">
          <AppPieChart data={summary?.byStatus || []} dataKey="c" nameKey="status" />
        </Card>
        <Card title="Feedbacks por tipo" subtitle="Orientativo · Reconhecimento · Avaliativo">
          <AppPieChart data={summary?.byType || []} dataKey="c" nameKey="type" formatName={(v) => v} />
        </Card>
        <Card title="Ranking de gestores" subtitle="Feedbacks no período">
          <AppBarChart data={summary?.byManager || []} dataKey="c" xKey="manager" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Lançamentos" subtitle="Histórico de feedbacks">
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows.data}
            total={rows.total}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onEdit={hasRole("administrador", "gestor") ? openEdit : undefined}
            onDelete={hasRole("administrador") ? (r) => setDeleteTarget(r) : undefined}
            onExport={() => exportCsv("suac_feedbacks.csv", rows.data.map((r) => ({ ...r, manager: managerName(r.manager_id), collaborator: collabName(r.collaborator_id) })))}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar feedback" : "Novo lançamento — Feedback"}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gestor" required>
              <Select required value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Colaborador" required>
              <Select required value={form.collaborator_id} onChange={(e) => setForm({ ...form, collaborator_id: e.target.value })}>
                {collaborators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" required value={form.feedback_date} onChange={(e) => setForm({ ...form, feedback_date: e.target.value })} />
            </Field>
            <Field label="Tipo de feedback" required>
              <Select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Status de aceite" required>
            <Select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Descrição">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        message="Tem certeza que deseja excluir este feedback? Esta ação não pode ser desfeita."
      />
    </div>
  );
}

export const feedbackHelpers = { labelFor };
