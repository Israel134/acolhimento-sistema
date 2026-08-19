import React, { useEffect, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
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
import { formatDate, label as labelFor, todayStr, exportCsv } from "../../lib/format";

interface ErrorRecord {
  id: number;
  record_date: string;
  unit: string;
  collaborator_id: number | null;
  error_type: string;
  severity: string;
  description: string | null;
  created_at: string;
}

interface Collaborator {
  id: number;
  name: string;
}

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const ERROR_TYPES = [
  { value: "cadastro", label: "Cadastro" },
  { value: "documentacao", label: "Documentação" },
  { value: "triagem", label: "Triagem" },
  { value: "comunicacao", label: "Comunicação" },
  { value: "sistema", label: "Sistema" },
  { value: "outro", label: "Outro" },
];
const SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
];

const emptyForm = { record_date: todayStr(), unit: UNITS[0], collaborator_id: "", error_type: "cadastro", severity: "leve", description: "" };

export default function SerecErrors() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: ErrorRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ErrorRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ErrorRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refreshing, lastUpdated, refresh } = usePolling(
    async () => {
      const res = await api.get("/serec/errors/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        total: number;
        byType: { error_type: string; total: number }[];
        bySeverity: { severity: string; total: number }[];
        daily: { date: string; total: number }[];
        ranking: { collaborator: string; total: number }[];
      };
    },
    [period.from, period.to]
  );

  usePageHeader({ title: "SEREC · Erros Operacionais", lastUpdated, onRefresh: refresh, refreshing });

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/serec/errors", { params: { search, page, pageSize: 10, sort: "record_date", order: "desc" } });
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
      // silencioso: o formulário ainda funciona sem a lista pré-carregada
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

  const openEdit = (row: ErrorRecord) => {
    setEditing(row);
    setForm({
      record_date: row.record_date,
      unit: row.unit,
      collaborator_id: row.collaborator_id ?? "",
      error_type: row.error_type,
      severity: row.severity,
      description: row.description || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, collaborator_id: form.collaborator_id ? Number(form.collaborator_id) : null };
      if (editing) {
        await api.put(`/serec/errors/${editing.id}`, payload);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/serec/errors", payload);
        notify("Erro operacional registrado com sucesso.");
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
      await api.delete(`/serec/errors/${deleteTarget.id}`);
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

  const columns: Column<ErrorRecord>[] = [
    { key: "record_date", header: "Data", render: (r) => formatDate(r.record_date) },
    { key: "unit", header: "Unidade" },
    { key: "collaborator_id", header: "Colaborador", render: (r) => collaboratorName(r.collaborator_id) },
    { key: "error_type", header: "Tipo", render: (r) => labelFor(r.error_type) },
    { key: "severity", header: "Gravidade", render: (r) => labelFor(r.severity) },
    { key: "description", header: "Descrição", render: (r) => r.description || "-" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {hasRole("administrador", "gestor", "operacional") && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo registro
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de erros" value={summaryLoading ? "…" : summary?.total ?? 0} icon={AlertTriangle} accent="var(--status-critical)" />
        {SEVERITIES.map((s) => (
          <KpiCard
            key={s.value}
            label={`Gravidade: ${s.label}`}
            value={summaryLoading ? "…" : summary?.bySeverity.find((x) => x.severity === s.value)?.total ?? 0}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Evolução diária" className="lg:col-span-2">
          <AppBarChart data={summary?.daily || []} dataKey="total" xKey="date" formatXLabel={formatDate} colorByIndex={false} />
        </Card>
        <Card title="Distribuição por tipo">
          <AppPieChart data={summary?.byType || []} dataKey="total" nameKey="error_type" />
        </Card>
      </div>

      <Card title="Ranking por colaborador" subtitle="Colaboradores com mais erros registrados no período">
        <AppBarChart data={summary?.ranking || []} dataKey="total" xKey="collaborator" formatXLabel={(v) => v} />
      </Card>

      <Card title="Registros" subtitle="Histórico de erros operacionais">
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
            onExport={() => exportCsv("serec_erros_operacionais.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar registro" : "Novo registro — Erro Operacional"}>
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
          <Field label="Colaborador envolvido">
            <Select value={form.collaborator_id} onChange={(e) => setForm({ ...form, collaborator_id: e.target.value })}>
              <option value="">Não identificado / não se aplica</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de erro" required>
              <Select required value={form.error_type} onChange={(e) => setForm({ ...form, error_type: e.target.value })}>
                {ERROR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Gravidade" required>
              <Select required value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
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
        message={`Tem certeza que deseja excluir este registro de ${deleteTarget ? formatDate(deleteTarget.record_date) : ""}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
