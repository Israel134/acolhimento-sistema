import { Router } from "express";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "serec_patients",
  module: "serec_pacientes",
  allowedFields: ["record_date", "unit", "category", "quantity", "observation"],
  searchFields: ["unit", "category", "observation"],
  defaultOrder: "record_date",
});

const router = Router();
router.use("/", base);

// Aggregation for dashboard: totals by category, daily evolution
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("record_date >= ?"); params.push(from); }
  if (to) { conditions.push("record_date <= ?"); params.push(to); }
  if (unit) { conditions.push("unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COALESCE(SUM(quantity),0) as total FROM serec_patients ${where}`).get(...params) as any).total;
  const byCategory = db
    .prepare(`SELECT category, SUM(quantity) as total FROM serec_patients ${where} GROUP BY category ORDER BY total DESC`)
    .all(...params);
  const daily = db
    .prepare(`SELECT record_date as date, SUM(quantity) as total FROM serec_patients ${where} GROUP BY record_date ORDER BY record_date ASC`)
    .all(...params);
  const byUnit = db
    .prepare(`SELECT unit, SUM(quantity) as total FROM serec_patients ${where} GROUP BY unit ORDER BY total DESC`)
    .all(...params);

  res.json({ total, byCategory, daily, byUnit });
});

export default router;
