import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "setip_transports",
  module: "setip_transporte",
  allowedFields: ["record_date", "unit", "collaborator_id", "quantity", "transport_type", "observation"],
  searchFields: ["unit", "transport_type", "observation"],
  defaultOrder: "record_date",
});

const router = Router();
router.use("/", base);

// Aggregation for dashboard: total, por mês, ranking por colaborador, por tipo, por unidade
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("t.record_date >= ?"); params.push(from); }
  if (to) { conditions.push("t.record_date <= ?"); params.push(to); }
  if (unit) { conditions.push("t.unit = ?"); params.push(unit); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COALESCE(SUM(t.quantity),0) as total FROM setip_transports t ${where}`).get(...params) as any).total;

  const byMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', t.record_date) as month, SUM(t.quantity) as total
       FROM setip_transports t ${where}
       GROUP BY month ORDER BY month ASC`
    )
    .all(...params);

  const byCollaborator = db
    .prepare(
      `SELECT c.name as collaborator, SUM(t.quantity) as total
       FROM setip_transports t
       JOIN collaborators c ON c.id = t.collaborator_id
       ${where}
       GROUP BY t.collaborator_id ORDER BY total DESC LIMIT 15`
    )
    .all(...params);

  const byType = db
    .prepare(`SELECT COALESCE(t.transport_type,'outro') as transport_type, SUM(t.quantity) as total FROM setip_transports t ${where} GROUP BY t.transport_type ORDER BY total DESC`)
    .all(...params);

  const byUnit = db
    .prepare(`SELECT t.unit, SUM(t.quantity) as total FROM setip_transports t ${where} GROUP BY t.unit ORDER BY total DESC`)
    .all(...params);

  const daily = db
    .prepare(`SELECT t.record_date as date, SUM(t.quantity) as total FROM setip_transports t ${where} GROUP BY t.record_date ORDER BY t.record_date ASC`)
    .all(...params);

  res.json({ total, byMonth, byCollaborator, byType, byUnit, daily });
});

export default router;
