import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "overtime",
  module: "horas_extras",
  allowedFields: ["record_date", "sector", "unit", "manager_id", "hours", "observation"],
  searchFields: ["sector", "unit", "observation"],
  defaultOrder: "record_date",
  writeRoles: ["administrador", "gestor"],
});

const router = Router();
router.use("/", base);

router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("record_date >= ?"); params.push(from); }
  if (to) { conditions.push("record_date <= ?"); params.push(to); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COALESCE(SUM(hours),0) as h FROM overtime ${where}`).get(...params) as any).h;
  const bySector = db
    .prepare(`SELECT sector, COALESCE(SUM(hours),0) as h FROM overtime ${where} GROUP BY sector ORDER BY h DESC`)
    .all(...params);
  const monthly = db
    .prepare(`SELECT strftime('%Y-%m', record_date) as month, COALESCE(SUM(hours),0) as h FROM overtime ${where} GROUP BY month ORDER BY month ASC`)
    .all(...params);
  const weekly = db
    .prepare(`SELECT strftime('%Y-W%W', record_date) as week, COALESCE(SUM(hours),0) as h FROM overtime ${where} GROUP BY week ORDER BY week ASC`)
    .all(...params);
  const byManager = db
    .prepare(
      `SELECT mg.name as manager, COALESCE(SUM(o.hours),0) as h FROM overtime o
       JOIN managers mg ON mg.id = o.manager_id ${where ? where.replace(/record_date/g, "o.record_date").replace("WHERE", "AND") : ""}
       GROUP BY o.manager_id ORDER BY h DESC LIMIT 15`
    )
    .all(...params);

  const totalSerec = (db.prepare(`SELECT COALESCE(SUM(hours),0) as h FROM overtime ${where}${where ? " AND" : "WHERE"} sector = 'SEREC'`).get(...params) as any).h;
  const totalSetip = (db.prepare(`SELECT COALESCE(SUM(hours),0) as h FROM overtime ${where}${where ? " AND" : "WHERE"} sector = 'SETIP'`).get(...params) as any).h;

  res.json({ total, totalSerec, totalSetip, bySector, monthly, weekly, byManager });
});

export default router;
