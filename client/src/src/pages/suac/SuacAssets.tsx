import React, { useEffect, useState } from "react";
import { Plus, Package } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, KpiCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { AppPieChart, AppBarChart } from "../../components/charts/Charts";
import { DataTable } from "../../components/ui/DataTable";
import type { Column } from "../../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Badge } from "../../components/ui/Badge";
import { exportCsv } from "../../lib/format";

interface AssetRecord {
  id: number;
  patrimony_number: string;
  name: string;
  category: string;
  location: string;
  responsible: string;
  acquisition_date: string;
  status: string;
  description: string | null;
}

const STATUSES = [
  { value: "bom_estado", label: "Em bom estado" },
  { value: "quebrado", label: "Quebrado" },
  { value: "chamado_aberto", label: "Chamado aberto" },
  { value: "resolvido", label: "Resolvido" },
  { value: "em_manutencao", label: "Em manutenção" },
  { value: "baixado", label: "Baixado" },
];
const CATEGORIES = ["Mobiliário", "Eletrônico", "Equipamento Médico", "Informática", "Outros"];

const emptyForm = {
  patrimony_number: "",
  name: "",
  category: CATEGORIES[0],
  location: "",
  responsible: "",
  acquisition_date: "",
  status: "bom_estado",
  description: "",
};

export function SuacAssets({ onChanged }: { onChanged?: () => void }) {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: AssetRecord[]; total: number }>({ data: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: summary, loading: summaryLoading, refresh } = usePolling(async () => {
    const res = await api.get("/assets/agg/summary");
    return res.data as { total: number; byStatus: { status: string; c: number }[]; byCategory: { category: string; c: number }[] };
  }, []);

  const loadTable = async () => {
    setTableLoading(true);
    try {
      const res = await api.get("/assets", { params: { search, page, pageSize: 10, sort: "name" } });
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

  const openEdit = (row: AssetRecord) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/assets/${editing.id}`, form);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/assets", form);
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
      await api.delete(`/assets/${deleteTarget.id}`);
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

  const columns: Column<AssetRecord>[] = [
    { key: "patrimony_number", header: "Nº Patrimônio" },
    { key: "name", header: "Descrição" },
    { key: "category", header: "Categoria" },
    { key: "location", header: "Localização" },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {hasRole("administrador", "gestor", "operacional") && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo patrimônio
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de patrimônios" value={summaryLoading ? "…" : summary?.total ?? 0} icon={Package} />
        <KpiCard label="Bom estado" value={summaryLoading ? "…" : summary?.byStatus.find((s) => s.status === "bom_estado")?.c ?? 0} accent="var(--status-good)" />
        <KpiCard label="Quebrados" value={summaryLoading ? "…" : summary?.byStatus.find((s) => s.status === "quebrado")?.c ?? 0} accent="var(--status-critical)" />
        <KpiCard label="Chamado aberto" value={summaryLoading ? "…" : summary?.byStatus.find((s) => s.status === "chamado_aberto")?.c ?? 0} accent="var(--status-warning)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Distribuição por status">
          <AppPieChart data={summary?.byStatus || []} dataKey="c" nameKey="status" />
        </Card>
        <Card title="Distribuição por categoria">
          <AppBarChart data={summary?.byCategory || []} dataKey="c" xKey="category" formatXLabel={(v) => v} />
        </Card>
      </div>

      <Card title="Patrimônios cadastrados">
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
            onExport={() => exportCsv("patrimonios.csv", rows.data)}
            loading={tableLoading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar patrimônio" : "Novo patrimônio"}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº Patrimônio">
              <Input value={form.patrimony_number} onChange={(e) => setForm({ ...form, patrimony_number: e.target.value })} />
            </Field>
            <Field label="Descrição" required>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Localização">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável">
              <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </Field>
            <Field label="Data de aquisição">
              <Input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Status" required>
            <Select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Observação">
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
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
