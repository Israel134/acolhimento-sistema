import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "serec_entries",
  module: "serec_entradas",
  allowedFields: ["record_date", "unit", "entry_type", "quantity", "observation"],
  searchFields: ["unit", "entry_type", "observation"],
  defaultOrder: "record_date",
});

const router = Router();
router.use("/", base);

// Aggregation for dashboard: totals by entry_type, daily evolution, by unit
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("record_date >= ?"); params.push(from); }
  if (to) { conditions.push("record_date <= ?"); params.push(to); }
  if (unit) { conditions.push("unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COALESCE(SUM(quantity),0) as total FROM serec_entries ${where}`).get(...params) as any).total;
  const byType = db
    .prepare(`SELECT entry_type, SUM(quantity) as total FROM serec_entries ${where} GROUP BY entry_type ORDER BY total DESC`)
    .all(...params);
  const daily = db
    .prepare(`SELECT record_date as date, SUM(quantity) as total FROM serec_entries ${where} GROUP BY record_date ORDER BY record_date ASC`)
    .all(...params);
  const byUnit = db
    .prepare(`SELECT unit, SUM(quantity) as total FROM serec_entries ${where} GROUP BY unit ORDER BY total DESC`)
    .all(...params);

  res.json({ total, byType, daily, byUnit });
});

export default router;
