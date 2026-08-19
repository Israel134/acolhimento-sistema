import React, { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useToast } from "../contexts/ToastContext";
import { Card, KpiCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/Form";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../lib/format";

interface UserRow {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  role_id: number;
  sector: string;
  position: string;
  status: string;
  last_login: string | null;
}

const SECTORS = ["SEREC", "SUAC", "SETIP", "SEPPERT", "GERAL"];
const emptyForm = { name: "", username: "", email: "", password: "", confirm: "", position: "", sector: SECTORS[0], role_id: "", status: "ativo" };

export default function Usuarios() {
  const { notify } = useToast();
  usePageHeader({ title: "Usuários" });

  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get("/users", { params: { search } }),
        roles.length ? Promise.resolve({ data: roles }) : api.get("/users/roles"),
      ]);
      setRows(u.data.data);
      if (!roles.length) setRoles(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, role_id: roles.find((r) => r.name === "operacional")?.id || roles[0]?.id || "" });
    setModalOpen(true);
  };
  const openEdit = (row: UserRow) => {
    setEditing(row);
    setForm({ name: row.name, username: row.username, email: row.email, position: row.position, sector: row.sector, role_id: row.role_id, status: row.status, password: "", confirm: "" });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && form.password !== form.confirm) {
      notify("A confirmação de senha não confere.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form);
        notify("Dados atualizados com sucesso.");
      } else {
        await api.post("/users", form);
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
      await api.delete(`/users/${deleteTarget.id}`);
      notify("Registro excluído com sucesso.");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<UserRow>[] = [
    { key: "name", header: "Nome" },
    { key: "username", header: "Usuário" },
    { key: "email", header: "E-mail" },
    { key: "role", header: "Perfil", render: (r) => <span className="capitalize">{r.role}</span> },
    { key: "sector", header: "Setor" },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
    { key: "last_login", header: "Último acesso", render: (r) => formatDateTime(r.last_login) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3">
        <KpiCard label="Usuários cadastrados" value={rows.length} icon={ShieldCheck} />
        <Button onClick={openCreate}><Plus size={16} /> Novo usuário</Button>
      </div>

      <Card title="Usuários do sistema" subtitle="Somente administradores podem gerenciar usuários">
        <div className="-m-4 sm:-m-5">
          <DataTable
            columns={columns}
            rows={rows}
            total={rows.length}
            page={1}
            pageSize={Math.max(rows.length, 1)}
            onPageChange={() => {}}
            onSearch={setSearch}
            onEdit={openEdit}
            onDelete={(r) => setDeleteTarget(r)}
            loading={loading}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuário" : "Novo usuário"}>
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Nome completo" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usuário" required>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="E-mail" required>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Senha" required>
                <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
              <Field label="Confirmação de senha" required>
                <Input type="password" required minLength={6} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cargo"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Setor">
              <Select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Perfil de acesso" required>
              <Select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.id} className="capitalize">{r.name}</option>)}
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
        message={`Tem certeza que deseja excluir o usuário "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
