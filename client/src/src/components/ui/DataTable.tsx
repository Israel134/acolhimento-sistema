import React, { useState } from "react";
import { Search, Pencil, Trash2, ChevronLeft, ChevronRight, Download, Inbox } from "lucide-react";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onSearch,
  onEdit,
  onDelete,
  onExport,
  loading,
  canEdit = true,
  canDelete = true,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onSearch?: (q: string) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onExport?: () => void;
  loading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
}) {
  const [q, setQ] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card-surface rounded-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border-b border-[var(--border-hairline)]">
        {onSearch && (
          <div className="relative flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-1)]/40"
            />
          </div>
        )}
        {onExport && (
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download size={14} /> Exportar CSV
          </Button>
        )}
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-left">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                  {c.header}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-[var(--border-hairline)]">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <div className="h-3.5 rounded bg-[var(--surface-1)] animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                  {(onEdit || onDelete) && <td />}
                </tr>
              ))
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-[var(--text-muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox size={28} />
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-hairline)] last:border-0 hover:bg-[var(--surface-1)]/60">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-[var(--text-primary)] whitespace-nowrap">
                      {c.render ? c.render(row) : (row as any)[c.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        {onEdit && canEdit && (
                          <button onClick={() => onEdit(row)} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--brand-1)] hover:bg-[var(--brand-1)]/10">
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDelete && canDelete && (
                          <button onClick={() => onDelete(row)} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical)]/10">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
        <span>{total} registro(s)</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-md border border-[var(--border-hairline)] disabled:opacity-40 hover:bg-[var(--surface-1)]"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-md border border-[var(--border-hairline)] disabled:opacity-40 hover:bg-[var(--surface-1)]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
