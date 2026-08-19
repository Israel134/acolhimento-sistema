import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { Card } from "../components/ui/Card";
import { Select, Input, Field } from "../components/ui/Form";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../lib/format";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";

interface AuditRow {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  module: string;
  record_id: string | null;
  old_data: string | null;
  new_data: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = { login: "Login", logout: "Logout", create: "Cadastro", update: "Alteração", delete: "Exclusão" };
const ACTION_STATUS: Record<string, string> = { login: "aceito", logout: "pendente", create: "aceito", update: "chamado_aberto", delete: "quebrado" };

export default function Auditoria() {
  usePageHeader({ title: "Auditoria" });
  const [rows, setRows] = useState<{ data: AuditRow[]; total: number }>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/audit", { params: { action, module: moduleFilter, from, to, page, pageSize: 15 } });
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, moduleFilter, from, to, page]);

  const columns: Column<AuditRow>[] = [
    { key: "created_at", header: "Data/Hora", render: (r) => formatDateTime(r.created_at) },
    { key: "user_name", header: "Usuário", render: (r) => r.user_name || "Sistema" },
    { key: "action", header: "Ação", render: (r) => <Badge status={ACTION_STATUS[r.action]}>{ACTION_LABEL[r.action] || r.action}</Badge> },
    { key: "module", header: "Módulo" },
    { key: "record_id", header: "Registro", render: (r) => r.record_id || "-" },
    {
      key: "details",
      header: "Detalhes",
      render: (r) => (
        <button
          onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          className="text-[var(--brand-1)] text-xs font-medium"
        >
          {expanded === r.id ? "Ocultar" : "Ver"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card title="Filtros">
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Ação">
            <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Cadastro</option>
              <option value="update">Alteração</option>
              <option value="delete">Exclusão</option>
            </Select>
          </Field>
          <Field label="Módulo">
            <Input value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} placeholder="ex: usuarios" />
          </Field>
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </Field>
        </div>
      </Card>

      <Card title="Registro de auditoria" subtitle="Login, cadastros, alterações e exclusões do sistema">
        <div className="-m-4 sm:-m-5">
          <DataTable columns={columns} rows={rows.data} total={rows.total} page={page} pageSize={15} onPageChange={setPage} loading={loading} />
        </div>
      </Card>

      {expanded && (() => {
        const row = rows.data.find((r) => r.id === expanded);
        if (!row) return null;
        return (
          <Card title={`Detalhes do registro #${row.id}`}>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-[var(--text-secondary)] mb-1">Informação anterior</p>
                <pre className="bg-[var(--surface-1)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{row.old_data ? JSON.stringify(JSON.parse(row.old_data), null, 2) : "—"}</pre>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-secondary)] mb-1">Informação nova</p>
                <pre className="bg-[var(--surface-1)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{row.new_data ? JSON.stringify(JSON.parse(row.new_data), null, 2) : "—"}</pre>
              </div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
