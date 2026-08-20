import React from "react";
import { label as labelFor } from "../../lib/format";

const STATUS_COLOR: Record<string, string> = {
  ativo: "var(--status-good)",
  aceito: "var(--status-good)",
  resolvido: "var(--status-good)",
  bom_estado: "var(--status-good)",
  pendente: "var(--status-warning)",
  chamado_aberto: "var(--status-warning)",
  em_manutencao: "var(--status-warning)",
  respondida: "var(--brand-3)",
  encerrada: "var(--status-good)",
  concluida: "var(--status-good)",
  em_andamento: "var(--brand-3)",
  atrasada: "var(--status-critical)",
  urgente: "var(--status-critical)",
  alta: "var(--status-warning)",
  moderada: "var(--brand-3)",
  baixa: "var(--text-muted)",
  sem_aceite: "var(--status-critical)",
  quebrado: "var(--status-critical)",
  inativo: "var(--text-muted)",
  baixado: "var(--text-muted)",
};

export function Badge({ status, children }: { status?: string; children?: React.ReactNode }) {
  const color = (status && STATUS_COLOR[status]) || "var(--brand-1)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children || labelFor(status)}
    </span>
  );
}
