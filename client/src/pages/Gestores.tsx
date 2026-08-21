import React, { useEffect, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Card, KpiCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { ImportButton } from "../components/ui/ImportButton";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/Form";
import { Badge } from "../components/ui/Badge";
import { exportCsv, label as labelFor } from "../lib/format";

interface Manager {
  id: number;
  name: string;
  rh: string;
  registration: string;
  position: string;
  sector: string;
  shift_type: string;
  status: string;
}

const SECTORS = ["SEREC", "SUAC", "SETIP", "SEPPERT"];
const emptyForm = { name: "", rh: "", registration: "", position: "", sector: SECTORS[0], shift_type: "diarista", status: "ativo" };

export default function Gestores() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  usePageHeader({ title: "Gestores" });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<{ data: Manager[]; total: number }>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Manager | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/managers", { params: { search, page, pageSize: 10 } });
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: Manager) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/managers/${editing.id}`, form);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/managers", form);
        notify("Dados cadastrados com sucesso.");
      }
      setModalOpen(false);
      load();
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
      await api.delete(`/managers/${deleteTarget.id}`);
      notify("Registro excluído com sucesso.");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Manager>[] = [
    { key: "name", header: "Nome" },
    { key: "rh", header: "RH" },
    { key: "sector", header: "Setor" },
    { key: "shift_type", header: "Escala", render: (r) => labelFor(r.shift_type) },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3">
        <KpiCard label="Gestores cadastrados" value={rows.total} icon={UserCog} />
        {hasRole("administrador") && (
          <div className="flex gap-2">
            <ImportButton resource="managers" label="Importar planilha" onDone={load} />
            <Button onClick={openCreate}><Plus size={16} /> Novo gestor</Button>
          </div>
        )}
      </div>

      <Card title="Gestores">
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows.data}
            total={rows.total}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onEdit={hasRole("administrador") ? openEdit : undefined}
            onDelete={hasRole("administrador") ? (r) => setDeleteTarget(r) : undefined}
            onExport={() => exportCsv("gestores.csv", rows.data)}
            loading={loading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar gestor" : "Novo gestor"}>
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Nome completo" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número do RH"><Input value={form.rh} onChange={(e) => setForm({ ...form, rh: e.target.value })} /></Field>
            <Field label="Matrícula"><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cargo"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Setor" required>
              <Select required value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de escala">
              <Select value={form.shift_type} onChange={(e) => setForm({ ...form, shift_type: e.target.value })}>
                <option value="diarista">Diarista</option>
                <option value="plantao">Plantão</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Field>
          </div>
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
