export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr.replace(" ", "T") + (dateStr.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("pt-BR");
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function firstDayOfMonthStr(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
}

export function lastDayOfMonthStr(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths + 1, 0);
  return d.toISOString().slice(0, 10);
}

export function firstDayOfYearStr() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function startOfWeekStr() {
  const d = new Date();
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? 6 : day - 1; // volta até segunda-feira
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  aceito: "Aceito",
  sem_aceite: "Sem aceite",
  pendente: "Pendente",
  bom_estado: "Bom estado",
  quebrado: "Quebrado",
  chamado_aberto: "Chamado aberto",
  resolvido: "Resolvido",
  em_manutencao: "Em manutenção",
  baixado: "Baixado",
  urgencia: "Urgência",
  ambulatorio: "Ambulatório",
  internados: "Internados",
  administrador: "Administrador",
  gestor: "Gestor",
  operacional: "Operacional",
  plantao: "Plantão",
  diarista: "Diarista",
  acompanhante: "Acompanhante",
  visitante: "Visitante",
  colaborador: "Colaborador",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  cadastro: "Cadastro",
  documentacao: "Documentação",
  triagem: "Triagem",
  comunicacao: "Comunicação",
  sistema: "Sistema",
  outro: "Outro",
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
};

export function label(key?: string | null) {
  if (!key) return "-";
  return STATUS_LABELS[key] || key;
}

export function exportCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
