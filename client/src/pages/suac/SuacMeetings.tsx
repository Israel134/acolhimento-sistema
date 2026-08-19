import React, { useEffect, useState } from "react";
import { Plus, CalendarDays, Paperclip, Trash2, Upload, FileText } from "lucide-react";
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
import { formatDate, formatMonth, label as labelFor, todayStr, exportCsv } from "../../lib/format";

interface Meeting {
  id: number;
  kind: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  subject: string | null;
  description: string | null;
  manager_id: number | null;
  manager_name: string | null;
  attachment_count: number;
}

interface Attachment {
  id: number;
  category: string;
  original_name: string;
  url: string;
  size: number;
}

const KINDS = [
  { value: "reuniao", label: "Reunião" },
  { value: "treinamento", label: "Treinamento" },
];
const ATTACH_CATEGORIES = [
  { value: "ata", label: "Ata de reunião" },
  { value: "lista_presenca", label: "Lista de presença" },
  { value: "relatorio", label: "Relatório" },
  { value: "material", label: "Material" },
  { value: "outro", label: "Outro" },
];

const emptyForm = {
  kind: "reuniao",
  title: "",
  meeting_date: todayStr(),
  meeting_time: "",
  location: "",
  subject: "",
  description: "",
  manager_id: "",
};

export function SuacMeetings() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const canWrite = hasRole("administrador", "gestor");
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: Meeting[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);

  // anexos
  const [attachOpen, setAttachOpen] = useState<Meeting | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachCategory, setAttachCategory] = useState("ata");
  const [uploading, setUploading] = useState(false);

  const { data: summary, loading: summaryLoading, refresh } = usePolling(
    async () => {
      const res = await api.get("/suac/meetings/agg/summary", { params: { from: period.from, to: period.to } });
      return res.data as {
        total: number;
        byManager: { manager: string; c: number }[];
        byMonth: { month: string; c: number }[];
        byWeek: { week: string; c: number }[];
        byKind: { kind: string; c: number }[];
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
      const res = await api.get("/suac/meetings", { params: { search, page, pageSize: 10 } });
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
    setForm({ ...emptyForm, manager_id: managers[0]?.id || "" });
    setModalOpen(true);
  };

  const openEdit = (row: Meeting) => {
    setEditing(row);
    setForm({
      kind: row.kind,
      title: row.title,
      meeting_date: row.meeting_date,
      meeting_time: row.meeting_time || "",
      location: row.location || "",
      subject: row.subject || "",
      description: row.description || "",
      manager_id: row.manager_id ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, manager_id: form.manager_id ? Number(form.manager_id) : null };
      if (editing) {
        await api.put(`/suac/meetings/${editing.id}`, payload);
        notify("Reunião atualizada com sucesso.");
      } else {
        await api.post("/suac/meetings", payload);
        notify("Reunião cadastrada com sucesso.");
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
      await api.delete(`/suac/meetings/${deleteTarget.id}`);
      notify("Reunião excluída com sucesso.");
      setDeleteTarget(null);
      loadTable();
      refresh();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const openAttachments = async (row: Meeting) => {
    setAttachOpen(row);
    try {
      const res = await api.get(`/suac/meetings/${row.id}`);
      setAttachments(res.data.attachments || []);
    } catch {
      setAttachments([]);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachOpen) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", attachCategory);
      await api.post(`/suac/meetings/${attachOpen.id}/attachments`, fd);
      notify("Anexo enviado com sucesso.");
      const res = await api.get(`/suac/meetings/${attachOpen.id}`);
      setAttachments(res.data.attachments || []);
      loadTable();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!attachOpen) return;
    try {
      await api.delete(`/suac/meetings/${attachOpen.id}/attachments/${attId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      loadTable();
      notify("Anexo removido.");
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    }
  };

  const thisMonth = summary?.byMonth?.length ? summary.byMonth[summary.byMonth.length - 1].c : 0;

  const columns: Column<Meeting>[] = [
    { key: "meeting_date", header: "Data", render: (r) => formatDate(r.meeting_date) + (r.meeting_time ? ` ${r.meeting_time}` : "") },
    { key: "kind", header: "Tipo", render: (r) => labelFor(r.kind) },
    { key: "title", header: "Assunto" },
    { key: "location", header: "Local", render: (r) => r.location || "-" },
    { key: "manager_name", header: "Gestor", render: (r) => r.manager_name || "-" },
    {
      key: "attachment_count",
      header: "Anexos",
      render: (r) => (
        <button
          onClick={() => openAttachments(r)}
          className="inline-flex items-center gap-1 text-[var(--brand-1)] hover:underline"
        >
          <Paperclip size={13} /> {r.attachment_count}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova reunião / treinamento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total no período" value={summaryLoading ? "…" : summary?.total ?? 0} icon={CalendarDays} />
        <KpiCard label="No mês mais recente" value={summaryLoading ? "…" : thisMonth} />
        <KpiCard label="Reuniões" value={summaryLoading ? "…" : summary?.byKind.find((k) => k.kind === "reuniao")?.c ?? 0} accent="var(--brand-3)" />
        <KpiCard label="Treinamentos" value={summaryLoading ? "…" : summary?.byKind.find((k) => k.kind === "treinamento")?.c ?? 0} accent="var(--brand-7)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Reuniões por mês" subtitle="Comparativo mensal">
          <AppBarChart data={summary?.byMonth || []} dataKey="c" xKey="month" formatXLabel={formatMonth} colorByIndex={false} />
        </Card>
        <Card title="Comparativo semanal" subtitle="Reuniões por semana">
          <AppBarChart data={summary?.byWeek || []} dataKey="c" xKey="week" formatXLabel={(v) => v.replace(/^\d{4}-/, "")} colorByIndex={false} />
        </Card>
      </div>

      <Card title="Ranking de gestores" subtitle="Reuniões/treinamentos por gestor responsável">
        <AppBarChart data={summary?.byManager || []} dataKey="c" xKey="manager" formatXLabel={(v) => v} />
      </Card>

      <Card title="Registros" subtitle="Reuniões e treinamentos cadastrados">
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
            onExport={() => exportCsv("suac_reunioes.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      {/* Modal cadastro */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar reunião / treinamento" : "Nova reunião / treinamento"} width="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" required>
              <Select required value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            </Field>
            <Field label="Gestor responsável">
              <Select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                <option value="">Selecione...</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Assunto / título" required>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Alinhamento mensal da equipe" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data" required>
              <Input type="date" required value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
            </Field>
            <Field label="Hora">
              <Input type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} />
            </Field>
            <Field label="Local">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Sala, unidade..." />
            </Field>
          </div>
          <Field label="Descrição / pauta">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal anexos */}
      <Modal open={!!attachOpen} onClose={() => setAttachOpen(null)} title={attachOpen ? `Anexos — ${attachOpen.title}` : ""} width="max-w-lg">
        <div className="space-y-4">
          {canWrite && (
            <div className="rounded-lg border border-dashed border-[var(--border-hairline)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Select value={attachCategory} onChange={(e) => setAttachCategory(e.target.value)} className="!w-auto text-xs">
                  {ATTACH_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[var(--brand-1)] text-white cursor-pointer hover:opacity-90">
                  <Upload size={15} /> {uploading ? "Enviando..." : "Enviar arquivo"}
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Aceita PDF, Word, Excel, imagens e outros (até 15 MB por arquivo).
              </p>
            </div>
          )}
          {attachments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">Nenhum anexo ainda.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] px-3 py-2">
                  <FileText size={16} className="text-[var(--text-muted)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-1)] hover:underline truncate block">
                      {a.original_name}
                    </a>
                    <p className="text-[11px] text-[var(--text-muted)]">{labelFor(a.category)} · {Math.round(a.size / 1024)} KB</p>
                  </div>
                  {canWrite && (
                    <button onClick={() => handleDeleteAttachment(a.id)} className="text-[var(--status-critical)] p-1 hover:bg-[var(--surface-1)] rounded" title="Remover anexo">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Os anexos vinculados também serão removidos. Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
