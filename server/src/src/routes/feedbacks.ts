import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "feedbacks",
  module: "feedbacks",
  allowedFields: ["manager_id", "collaborator_id", "feedback_date", "type", "status", "description"],
  searchFields: ["type", "description"],
  defaultOrder: "feedback_date",
  writeRoles: ["administrador", "gestor"],
});

const router = Router();
router.use("/", base);

router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("feedback_date >= ?"); params.push(from); }
  if (to) { conditions.push("feedback_date <= ?"); params.push(to); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COUNT(*) as c FROM feedbacks ${where}`).get(...params) as any).c;
  const byStatus = db
    .prepare(`SELECT status, COUNT(*) as c FROM feedbacks ${where} GROUP BY status`)
    .all(...params);
  const byManager = db
    .prepare(
      `SELECT m.name as manager, COUNT(*) as c FROM feedbacks f
       JOIN managers m ON m.id = f.manager_id ${where ? where.replace("WHERE", "AND") : ""}
       GROUP BY f.manager_id ORDER BY c DESC LIMIT 10`
    )
    .all(...params);
  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', feedback_date) as month, COUNT(*) as c FROM feedbacks ${where}
       GROUP BY month ORDER BY month ASC`
    )
    .all(...params);

  res.json({ total, byStatus, byManager, monthly });
});

export default router;
