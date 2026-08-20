import React, { useEffect, useState } from "react";
import { Plus, ClipboardList, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Card, KpiCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { AppBarChart, AppPieChart } from "../components/charts/Charts";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../components/ui/Form";
import { Badge } from "../components/ui/Badge";
import { formatDate, label as labelFor, exportCsv } from "../lib/format";

interface Task {
  id: number;
  title: string;
  description: string | null;
  assigned_to: number | null;
  assigned_name: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  observation: string | null;
  overdue: boolean;
  effective_status: string;
}

const PRIORITIES = [
  { value: "urgente", label: "Urgente" },
  { value: "alta", label: "Alta" },
  { value: "moderada", label: "Moderada" },
  { value: "baixa", label: "Baixa" },
];
const STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
];

const emptyForm = { title: "", description: "", assigned_to: "", priority: "moderada", due_date: "", observation: "" };

export default function Tarefas() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const isAdmin = hasRole("administrador");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: Task[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refreshing, lastUpdated, refresh } = usePolling(
    async () => {
      const res = await api.get("/tasks/agg/summary");
      return res.data as {
        total: number; concluidas: number; pendentes: number; atrasadas: number;
        byPriority: { priority: string; c: number }[];
        byStatus: { status: string; c: number }[];
        ranking: { responsible: string; c: number }[];
      };
    },
    []
  );

  usePageHeader({ title: "Tarefas", lastUpdated, onRefresh: refresh, refreshing });

  useEffect(() => {
    if (isAdmin) {
      api.get("/users").then((r) => setUsers(r.data.data)).catch(() => {});
    }
  }, [isAdmin]);

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/tasks", { params: { search, page, pageSize: 10 } });
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
    setForm({ ...emptyForm, assigned_to: users[0]?.id || "" });
    setModalOpen(true);
  };

  const openEdit = (row: Task) => {
    setEditing(row);
    setForm({
      title: row.title,
      description: row.description || "",
      assigned_to: row.assigned_to ?? "",
      priority: row.priority,
      due_date: row.due_date || "",
      status: row.status,
      observation: row.observation || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null };
      if (editing) {
        await api.put(`/tasks/${editing.id}`, payload);
        notify("Tarefa atualizada com sucesso.");
      } else {
        await api.post("/tasks", payload);
        notify("Tarefa criada com sucesso.");
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
      await api.delete(`/tasks/${deleteTarget.id}`);
      notify("Tarefa excluída com sucesso.");
      setDeleteTarget(null);
      loadTable();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (task: Task, status: string) => {
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      notify("Status atualizado.");
      loadTable();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    }
  };

  const columns: Column<Task>[] = [
    { key: "title", header: "Título" },
    { key: "assigned_name", header: "Responsável", render: (r) => r.assigned_name || "-" },
    { key: "priority", header: "Prioridade", render: (r) => <Badge status={r.priority} /> },
    { key: "due_date", header: "Prazo", render: (r) => formatDate(r.due_date) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <select
            value={r.status}
            onChange={(e) => handleStatusChange(r, e.target.value)}
            className="text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--brand-1)]/40"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {r.overdue && <Badge status="atrasada">Atrasada</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova tarefa
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de tarefas" value={summaryLoading ? "…" : summary?.total ?? 0} icon={ClipboardList} />
        <KpiCard label="Concluídas" value={summaryLoading ? "…" : summary?.concluidas ?? 0} icon={CheckCircle2} accent="var(--status-good)" />
        <KpiCard label="Pendentes" value={summaryLoading ? "…" : summary?.pendentes ?? 0} icon={Clock} accent="var(--status-warning)" />
        <KpiCard label="Atrasadas" value={summaryLoading ? "…" : summary?.atrasadas ?? 0} icon={AlertTriangle} accent="var(--status-critical)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Por prioridade">
          <AppPieChart data={summary?.byPriority || []} dataKey="c" nameKey="priority" />
        </Card>
        <Card title="Por status">
          <AppPieChart data={summary?.byStatus || []} dataKey="c" nameKey="status" />
        </Card>
        <Card title="Ranking por responsável">
          <AppBarChart data={summary?.ranking || []} dataKey="c" xKey="responsible" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Tarefas" subtitle={isAdmin ? "Todas as tarefas" : "Suas tarefas atribuídas"}>
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows.data}
            total={rows.total}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onEdit={isAdmin ? openEdit : undefined}
            onDelete={isAdmin ? (r) => setDeleteTarget(r) : undefined}
            onExport={() => exportCsv("tarefas.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      {!isAdmin && (
        <p className="text-xs text-[var(--text-muted)]">
          Como gestor, você pode visualizar suas tarefas e atualizar o status delas (incluindo marcar como concluída).
          A criação, edição e exclusão de tarefas é feita pela administração.
        </p>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar tarefa" : "Nova tarefa"} width="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Título" required>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável">
              <Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">Selecione...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({labelFor(u.role)})</option>)}
              </Select>
            </Field>
            <Field label="Prioridade" required>
              <Select required value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prazo">
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            {editing && (
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            )}
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
        message={`Tem certeza que deseja excluir a tarefa "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
