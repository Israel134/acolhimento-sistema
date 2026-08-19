import React, { useEffect, useState } from "react";
import { Plus, MessageSquareWarning, Bell } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PeriodFilter, defaultPeriod } from "../../components/ui/PeriodFilter";
import type { Period } from "../../components/ui/PeriodFilter";
import { AppBarChart, AppMultiLineChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Badge } from "../../components/ui/Badge";
import { formatDate, formatMonth, label as labelFor, todayStr, exportCsv } from "../../lib/format";

interface Record_ {
  id: number;
  record_type: string;
  number: string | null;
  occurrence_date: string;
  response_date: string | null;
  sector: string | null;
  manager_id: number | null;
  status: string;
  description: string | null;
}

interface Metrics {
  total: number;
  respondidas: number;
  encerradas: number;
  pendentes: number;
  resolutionRate: number;
}

const TYPES = [
  { value: "ouvidoria", label: "Ouvidoria" },
  { value: "notificacao", label: "Notificação" },
];
const STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "respondida", label: "Respondida" },
  { value: "encerrada", label: "Encerrada" },
];
const SECTORS = ["SEREC", "SUAC", "SETIP", "SEPPERT", "GERAL"];

const emptyForm = {
  record_type: "ouvidoria",
  number: "",
  occurrence_date: todayStr(),
  response_date: "",
  sector: "SUAC",
  manager_id: "",
  status: "pendente",
  description: "",
};

export function SuacOmbudsman() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const canWrite = hasRole("administrador", "gestor");
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: Record_[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record_ | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record_ | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refresh } = usePolling(
    async () => {
      const res = await api.get("/suac/ombudsman/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        ouvidorias: Metrics;
        notificacoes: Metrics;
        monthly: { month: string; record_type: string; c: number }[];
        bySector: { sector: string; c: number }[];
        byManager: { manager: string; c: number }[];
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
      const res = await api.get("/suac/ombudsman", { params: { search, page, pageSize: 10, sort: "occurrence_date", order: "desc" } });
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

  const openEdit = (row: Record_) => {
    setEditing(row);
    setForm({
      record_type: row.record_type,
      number: row.number || "",
      occurrence_date: row.occurrence_date,
      response_date: row.response_date || "",
      sector: row.sector || "SUAC",
      manager_id: row.manager_id ?? "",
      status: row.status,
      description: row.description || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, manager_id: form.manager_id ? Number(form.manager_id) : null, response_date: form.response_date || null };
      if (editing) {
        await api.put(`/suac/ombudsman/${editing.id}`, payload);
        notify("Registro atualizado com sucesso.");
      } else {
        await api.post("/suac/ombudsman", payload);
        notify("Registro cadastrado com sucesso.");
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
      await api.delete(`/suac/ombudsman/${deleteTarget.id}`);
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

  // Monta série mensal com duas linhas (ouvidoria x notificação)
  const monthlyData = React.useMemo(() => {
    const map: Record<string, { month: string; ouvidoria: number; notificacao: number }> = {};
    (summary?.monthly || []).forEach((m) => {
      if (!map[m.month]) map[m.month] = { month: m.month, ouvidoria: 0, notificacao: 0 };
      if (m.record_type === "ouvidoria") map[m.month].ouvidoria = m.c;
      else map[m.month].notificacao = m.c;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [summary]);

  const columns: Column<Record_>[] = [
    { key: "record_type", header: "Tipo", render: (r) => labelFor(r.record_type) },
    { key: "number", header: "Número", render: (r) => r.number || "-" },
    { key: "occurrence_date", header: "Ocorrência", render: (r) => formatDate(r.occurrence_date) },
    { key: "response_date", header: "Resposta", render: (r) => formatDate(r.response_date) },
    { key: "sector", header: "Setor", render: (r) => r.sector || "-" },
    { key: "manager_id", header: "Gestor", render: (r) => managerName(r.manager_id) },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  ];

  const ouv = summary?.ouvidorias;
  const notif = summary?.notificacoes;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo registro
          </Button>
        )}
      </div>

      {/* Ouvidorias */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquareWarning size={16} className="text-[var(--brand-1)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ouvidorias</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Recebidas" value={summaryLoading ? "…" : ouv?.total ?? 0} />
          <KpiCard label="Respondidas" value={summaryLoading ? "…" : (ouv ? ouv.respondidas + ouv.encerradas : 0)} accent="var(--status-good)" />
          <KpiCard label="Pendentes" value={summaryLoading ? "…" : ouv?.pendentes ?? 0} accent="var(--status-warning)" />
          <KpiCard label="Taxa de resolução" value={summaryLoading ? "…" : `${ouv?.resolutionRate ?? 0}%`} accent="var(--brand-3)" />
        </div>
      </div>

      {/* Notificações */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bell size={16} className="text-[var(--brand-7)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notificações</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Recebidas" value={summaryLoading ? "…" : notif?.total ?? 0} />
          <KpiCard label="Respondidas" value={summaryLoading ? "…" : (notif ? notif.respondidas + notif.encerradas : 0)} accent="var(--status-good)" />
          <KpiCard label="Pendentes" value={summaryLoading ? "…" : notif?.pendentes ?? 0} accent="var(--status-warning)" />
          <KpiCard label="Taxa de resolução" value={summaryLoading ? "…" : `${notif?.resolutionRate ?? 0}%`} accent="var(--brand-3)" />
        </div>
      </div>

      <Card title="Evolução mensal" subtitle="Ouvidorias e notificações por mês">
        <AppMultiLineChart
          data={monthlyData}
          xKey="month"
          formatX={formatMonth}
          lines={[
            { dataKey: "ouvidoria", label: "Ouvidorias" },
            { dataKey: "notificacao", label: "Notificações" },
          ]}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Comparativo por setor">
          <AppBarChart data={summary?.bySector || []} dataKey="c" xKey="sector" formatXLabel={(v) => v} />
        </Card>
        <Card title="Comparativo por gestor">
          <AppBarChart data={summary?.byManager || []} dataKey="c" xKey="manager" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Registros" subtitle="Ouvidorias e notificações cadastradas">
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
            onExport={() => exportCsv("suac_ouvidorias.csv", rows.data.map((r) => ({ ...r, manager: managerName(r.manager_id) })))}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar registro" : "Novo registro — Ouvidoria / Notificação"} width="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" required>
              <Select required value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value })}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label={form.record_type === "ouvidoria" ? "Número da ouvidoria" : "Número da notificação"}>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Ex: 2026-0142" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da ocorrência" required>
              <Input type="date" required value={form.occurrence_date} onChange={(e) => setForm({ ...form, occurrence_date: e.target.value })} />
            </Field>
            <Field label="Data da resposta">
              <Input type="date" value={form.response_date} onChange={(e) => setForm({ ...form, response_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Setor responsável">
              <Select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Gestor responsável">
              <Select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                <option value="">Selecione...</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Status" required>
            <Select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Descrição">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        message="Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
