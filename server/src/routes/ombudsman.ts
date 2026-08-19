import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "ombudsman",
  module: "ouvidorias",
  allowedFields: ["record_type", "number", "occurrence_date", "response_date", "sector", "manager_id", "status", "description"],
  searchFields: ["number", "sector", "description"],
  defaultOrder: "occurrence_date",
  writeRoles: ["administrador", "gestor"],
});

const router = Router();
router.use("/", base);

function summaryFor(recordType: string, from?: string, to?: string, sector?: string) {
  const conditions: string[] = ["record_type = ?"];
  const params: any[] = [recordType];
  if (from) { conditions.push("occurrence_date >= ?"); params.push(from); }
  if (to) { conditions.push("occurrence_date <= ?"); params.push(to); }
  if (sector) { conditions.push("sector = ?"); params.push(sector); }
  const where = "WHERE " + conditions.join(" AND ");

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='respondida' THEN 1 ELSE 0 END) as respondidas,
        SUM(CASE WHEN status='encerrada' THEN 1 ELSE 0 END) as encerradas,
        SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) as pendentes
       FROM ombudsman ${where}`
    )
    .get(...params) as any;
  const resolved = (totals.respondidas || 0) + (totals.encerradas || 0);
  const resolutionRate = totals.total ? Math.round((resolved / totals.total) * 1000) / 10 : 0;

  return { ...totals, resolutionRate };
}

router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, sector } = req.query as Record<string, string>;

  const ouvidorias = summaryFor("ouvidoria", from, to, sector);
  const notificacoes = summaryFor("notificacao", from, to, sector);

  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("o.occurrence_date >= ?"); params.push(from); }
  if (to) { conditions.push("o.occurrence_date <= ?"); params.push(to); }
  if (sector) { conditions.push("o.sector = ?"); params.push(sector); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', o.occurrence_date) as month, o.record_type,
        COUNT(*) as c
       FROM ombudsman o ${where}
       GROUP BY month, o.record_type ORDER BY month ASC`
    )
    .all(...params);

  const bySector = db
    .prepare(`SELECT COALESCE(o.sector,'—') as sector, COUNT(*) as c FROM ombudsman o ${where} GROUP BY o.sector ORDER BY c DESC`)
    .all(...params);

  const byManager = db
    .prepare(
      `SELECT mg.name as manager, COUNT(*) as c FROM ombudsman o
       JOIN managers mg ON mg.id = o.manager_id ${where ? where.replace("WHERE", "AND") : ""}
       GROUP BY o.manager_id ORDER BY c DESC LIMIT 15`
    )
    .all(...params);

  res.json({ ouvidorias, notificacoes, monthly, bySector, byManager });
});

export default router;
