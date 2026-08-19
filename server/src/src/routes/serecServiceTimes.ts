import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "serec_service_times",
  module: "serec_tempo_atendimento",
  allowedFields: ["record_date", "unit", "shift", "avg_wait_minutes", "avg_service_minutes", "observation"],
  searchFields: ["unit", "shift", "observation"],
  defaultOrder: "record_date",
});

const router = Router();
router.use("/", base);

// Aggregation for dashboard: averages for the two sub-indicators, daily evolution, by unit
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("record_date >= ?"); params.push(from); }
  if (to) { conditions.push("record_date <= ?"); params.push(to); }
  if (unit) { conditions.push("unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const averages = db
    .prepare(
      `SELECT
        ROUND(AVG(avg_wait_minutes), 1) as avgWait,
        ROUND(AVG(avg_service_minutes), 1) as avgService
       FROM serec_service_times ${where}`
    )
    .get(...params) as any;
  const daily = db
    .prepare(
      `SELECT record_date as date,
        ROUND(AVG(avg_wait_minutes), 1) as avgWait,
        ROUND(AVG(avg_service_minutes), 1) as avgService
       FROM serec_service_times ${where} GROUP BY record_date ORDER BY record_date ASC`
    )
    .all(...params);
  const byUnit = db
    .prepare(
      `SELECT unit,
        ROUND(AVG(avg_wait_minutes), 1) as avgWait,
        ROUND(AVG(avg_service_minutes), 1) as avgService
       FROM serec_service_times ${where} GROUP BY unit`
    )
    .all(...params);

  res.json({
    avgWait: averages?.avgWait || 0,
    avgService: averages?.avgService || 0,
    daily,
    byUnit,
  });
});

export default router;
