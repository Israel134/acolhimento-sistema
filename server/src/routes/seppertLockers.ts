import { Router } from "express";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const ARMARIOS = 4;
const FILEIRAS = 4;
const POSICOES = 16;

// Cria a grade fixa (2 unidades × 4 armários × 4 fileiras × 16 posições) se ainda não existir.
export function ensureSeppertGrid() {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM seppert_lockers`).get() as any).c;
  const expected = UNITS.length * ARMARIOS * FILEIRAS * POSICOES;
  if (count >= expected) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO seppert_lockers (unit, armario, fileira, posicao, status) VALUES (?, ?, ?, ?, 'livre')`
  );
  const tx = db.transaction(() => {
    for (const unit of UNITS) {
      for (let a = 1; a <= ARMARIOS; a++) {
        for (let f = 1; f <= FILEIRAS; f++) {
          for (let p = 1; p <= POSICOES; p++) {
            insert.run(unit, a, f, p);
          }
        }
      }
    }
  });
  tx();
}

ensureSeppertGrid();

// Lista posições, com filtros opcionais (unit, armario, status, search por paciente)
router.get("/", requireAuth, (req, res) => {
  const { unit, armario, status, search } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (unit) { conditions.push("unit = ?"); params.push(unit); }
  if (armario) { conditions.push("armario = ?"); params.push(Number(armario)); }
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (search) { conditions.push("(patient_name LIKE ? OR description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const rows = db
    .prepare(`SELECT * FROM seppert_lockers ${where} ORDER BY unit, armario, fileira, posicao`)
    .all(...params);
  res.json({ data: rows, total: rows.length });
});

// Dashboard: ocupação total, por unidade e por armário
router.get("/agg/summary", requireAuth, (req, res) => {
  const { unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (unit) { conditions.push("unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='ocupado' THEN 1 ELSE 0 END) as ocupado,
        SUM(CASE WHEN status='livre' THEN 1 ELSE 0 END) as livre
       FROM seppert_lockers ${where}`
    )
    .get(...params) as any;

  const byUnit = db
    .prepare(
      `SELECT unit,
        COUNT(*) as total,
        SUM(CASE WHEN status='ocupado' THEN 1 ELSE 0 END) as ocupado,
        SUM(CASE WHEN status='livre' THEN 1 ELSE 0 END) as livre
       FROM seppert_lockers ${where} GROUP BY unit ORDER BY unit`
    )
    .all(...params);

  const byArmario = db
    .prepare(
      `SELECT unit, armario,
        COUNT(*) as total,
        SUM(CASE WHEN status='ocupado' THEN 1 ELSE 0 END) as ocupado
       FROM seppert_lockers ${where} GROUP BY unit, armario ORDER BY unit, armario`
    )
    .all(...params);

  const occupancyRate = totals.total ? Math.round((totals.ocupado / totals.total) * 1000) / 10 : 0;

  res.json({
    total: totals.total,
    ocupado: totals.ocupado,
    livre: totals.livre,
    occupancyRate,
    byUnit,
    byArmario,
    statusChart: [
      { status: "ocupado", c: totals.ocupado },
      { status: "livre", c: totals.livre },
    ],
  });
});

// Ocupar / editar uma posição (com dados do paciente)
router.put("/:id/ocupar", requireAuth, requireRole("administrador", "gestor", "operacional"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM seppert_lockers WHERE id = ?`).get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Posição não encontrada." });
    const { patient_name, entry_date, description } = req.body || {};
    if (!patient_name || !String(patient_name).trim()) {
      return res.status(400).json({ error: "Informe o nome do paciente para ocupar a posição." });
    }
    db.prepare(
      `UPDATE seppert_lockers
       SET status='ocupado', patient_name=?, entry_date=COALESCE(?, entry_date, date('now')), description=?, exit_date=NULL,
           updated_by=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(patient_name, entry_date || null, description || null, req.user!.id, req.params.id);
    const updated = db.prepare(`SELECT * FROM seppert_lockers WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "seppert_pertences", recordId: req.params.id, oldData: existing, newData: updated });
    res.json(updated);
  } catch (err: any) {
    console.error(`[seppert] Falha ao ocupar posição (id=${req.params.id}):`, err);
    res.status(500).json({ error: "Erro interno do servidor ao ocupar a posição.", details: err?.message });
  }
});

// Liberar uma posição (registra saída e limpa os dados do paciente)
router.put("/:id/liberar", requireAuth, requireRole("administrador", "gestor", "operacional"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM seppert_lockers WHERE id = ?`).get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Posição não encontrada." });
    db.prepare(
      `UPDATE seppert_lockers
       SET status='livre', patient_name=NULL, entry_date=NULL, exit_date=date('now'), description=NULL,
           updated_by=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(req.user!.id, req.params.id);
    const updated = db.prepare(`SELECT * FROM seppert_lockers WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "seppert_pertences", recordId: req.params.id, oldData: existing, newData: updated });
    res.json(updated);
  } catch (err: any) {
    console.error(`[seppert] Falha ao liberar posição (id=${req.params.id}):`, err);
    res.status(500).json({ error: "Erro interno do servidor ao liberar a posição.", details: err?.message });
  }
});

export default router;
