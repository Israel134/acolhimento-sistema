import * as XLSX from "xlsx";
import db from "../db/connection";
import { logAudit } from "../utils/audit";

// Normaliza cabeçalho/valor: minúsculo, sem acento, sem espaços extras
export function norm(s: any): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

type FieldType = "text" | "int" | "number" | "date";

export interface ImportColumn {
  field: string;
  labels: string[];            // possíveis nomes de coluna na planilha
  required?: boolean;
  type?: FieldType;
  enumMap?: Record<string, string>; // normalizedLabel -> valor canônico
  default?: any;
}

export interface ImportLookup {
  field: string;               // campo destino (ex: manager_id)
  labels: string[];            // coluna com o nome (ex: "Gestor")
  table: string;               // tabela de referência (ex: managers)
  matchColumn?: string;        // coluna de nome (default: name)
  required?: boolean;
}

export interface PromptField {
  field: string;
  label: string;
  options?: string[];          // se presente, vira um <select>
}

export interface ImportConfig {
  table: string;
  module: string;
  columns: ImportColumn[];
  lookups?: ImportLookup[];
  uniqueBy?: string[];         // campos que definem duplicidade (pula se já existe)
  writeRoles?: string[];
  // campos que o usuário pode informar manualmente quando a planilha não tem a coluna
  promptFields?: PromptField[];
  // transform final da linha antes de inserir (ex: montar defaults)
  finalize?: (row: Record<string, any>) => Record<string, any>;
}

function toISODate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  // número serial do Excel
  if (typeof v === "number") {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy ou dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s; // deixa como veio
}

function coerce(type: FieldType | undefined, raw: any, enumMap?: Record<string, string>): any {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  if (enumMap) {
    const mapped = enumMap[norm(raw)];
    if (mapped) return mapped;
    // se já for um valor canônico conhecido, mantém
    const canon = new Set(Object.values(enumMap));
    const underscored = norm(raw).replace(/\s+/g, "_");
    if (canon.has(underscored)) return underscored;
    return String(raw).trim();
  }
  switch (type) {
    case "int": {
      const n = parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    case "number": {
      const n = parseFloat(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
      return isNaN(n) ? null : n;
    }
    case "date":
      return toISODate(raw);
    default:
      return String(raw).trim();
  }
}

// Lê o buffer (xlsx ou csv) e devolve array de objetos {header: value}
export function parseSheet(buffer: Buffer): Record<string, any>[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  total: number;
}

export function runImport(config: ImportConfig, buffer: Buffer, userId: number, overrides: Record<string, any> = {}): ImportResult {
  const rows = parseSheet(buffer);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], total: rows.length };

  // pré-mapeia cabeçalhos disponíveis (normalizados)
  const insertFields = config.columns.map((c) => c.field).concat((config.lookups || []).map((l) => l.field));

  const tx = db.transaction(() => {
    rows.forEach((raw, idx) => {
      const rowNum = idx + 2; // +1 header, +1 base-1
      try {
        // acha valor por labels
        const findVal = (labels: string[]) => {
          const wanted = labels.map(norm);
          for (const key of Object.keys(raw)) {
            if (wanted.includes(norm(key))) return raw[key];
          }
          return undefined;
        };

        const record: Record<string, any> = {};
        // colunas simples
        for (const col of config.columns) {
          let v = coerce(col.type, findVal(col.labels), col.enumMap);
          // valor informado manualmente na tela (usado quando a planilha não tem a coluna)
          if ((v === null || v === undefined || v === "") && overrides[col.field] !== undefined && overrides[col.field] !== "") {
            v = coerce(col.type, overrides[col.field], col.enumMap);
          }
          if ((v === null || v === undefined) && col.default !== undefined) v = col.default;
          if (col.required && (v === null || v === undefined || v === "")) {
            throw new Error(`Coluna obrigatória ausente/vazia: ${col.labels[0]}`);
          }
          record[col.field] = v;
        }
        // lookups (nome -> id)
        for (const lk of config.lookups || []) {
          const nameVal = findVal(lk.labels);
          if (nameVal === undefined || String(nameVal).trim() === "") {
            if (lk.required) throw new Error(`Coluna obrigatória ausente/vazia: ${lk.labels[0]}`);
            record[lk.field] = null;
            continue;
          }
          const col = lk.matchColumn || "name";
          const found = db
            .prepare(`SELECT id FROM ${lk.table} WHERE ${col} = ? COLLATE NOCASE LIMIT 1`)
            .get(String(nameVal).trim()) as any;
          if (!found) {
            if (lk.required) throw new Error(`Não encontrado em ${lk.table}: "${nameVal}"`);
            record[lk.field] = null;
          } else {
            record[lk.field] = found.id;
          }
        }

        let finalRow = config.finalize ? config.finalize(record) : record;

        // duplicidade
        if (config.uniqueBy && config.uniqueBy.length) {
          const conds = config.uniqueBy.map((f) => `${f} = ?`).join(" AND ");
          const vals = config.uniqueBy.map((f) => finalRow[f]);
          const existing = db.prepare(`SELECT id FROM ${config.table} WHERE ${conds} LIMIT 1`).get(...vals);
          if (existing) {
            result.skipped++;
            return;
          }
        }

        const fields = insertFields.filter((f) => finalRow[f] !== undefined);
        const cols = [...fields, "created_by"];
        const placeholders = cols.map(() => "?").join(",");
        const values = [...fields.map((f) => finalRow[f]), userId];
        db.prepare(`INSERT INTO ${config.table} (${cols.join(",")}) VALUES (${placeholders})`).run(...values);
        result.imported++;
      } catch (err: any) {
        result.errors.push({ row: rowNum, message: err?.message || "Erro ao processar a linha." });
      }
    });
  });
  tx();

  logAudit({
    userId,
    action: "create",
    module: `${config.module}_import`,
    recordId: null,
    newData: { imported: result.imported, skipped: result.skipped, errors: result.errors.length },
  });

  return result;
}

// Gera um CSV de modelo a partir dos rótulos amigáveis das colunas + lookups
export function templateCsv(config: ImportConfig): string {
  const headers = [
    ...config.columns.map((c) => c.labels[0]),
    ...(config.lookups || []).map((l) => l.labels[0]),
  ];
  return "﻿" + headers.map((h) => `"${h}"`).join(",") + "\n";
}
