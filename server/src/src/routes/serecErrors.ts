import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "serec_operational_errors",
  module: "serec_erros_operacionais",
  allowedFields: ["record_date", "unit", "collaborator_id", "error_type", "severity", "description"],
  searchFields: ["unit", "error_type", "severity", "description"],
  defaultOrder: "record_date",
});

const router = Router();
router.use("/", base);

// Aggregation for dashboard: totals by type/severity, daily evolution, ranking by collaborator
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("e.record_date >= ?"); params.push(from); }
  if (to) { conditions.push("e.record_date <= ?"); params.push(to); }
  if (unit) { conditions.push("e.unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COUNT(*) as total FROM serec_operational_errors e ${where}`).get(...params) as any).total;
  const byType = db
    .prepare(`SELECT e.error_type, COUNT(*) as total FROM serec_operational_errors e ${where} GROUP BY e.error_type ORDER BY total DESC`)
    .all(...params);
  const bySeverity = db
    .prepare(`SELECT e.severity, COUNT(*) as total FROM serec_operational_errors e ${where} GROUP BY e.severity ORDER BY total DESC`)
    .all(...params);
  const daily = db
    .prepare(`SELECT e.record_date as date, COUNT(*) as total FROM serec_operational_errors e ${where} GROUP BY e.record_date ORDER BY e.record_date ASC`)
    .all(...params);
  const ranking = db
    .prepare(
      `SELECT c.name as collaborator, COUNT(*) as total
       FROM serec_operational_errors e
       JOIN collaborators c ON c.id = e.collaborator_id
       ${where}
       GROUP BY e.collaborator_id ORDER BY total DESC LIMIT 10`
    )
    .all(...params);

  res.json({ total, byType, bySeverity, daily, ranking });
});

export default router;
