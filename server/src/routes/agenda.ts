import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { buildCrudRouter } from "../utils/crudFactory";

const base = buildCrudRouter({
  table: "agenda_events",
  module: "agenda",
  allowedFields: ["title", "event_date", "start_time", "end_time", "location", "participants", "description"],
  searchFields: ["title", "location", "participants", "description"],
  defaultOrder: "event_date",
  writeRoles: ["administrador", "gestor"],
  deleteRoles: ["administrador", "gestor"],
});

const router = Router();

// Lista eventos num intervalo (para as visões dia/semana/mês)
router.get("/range/list", requireAuth, (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("event_date >= ?"); params.push(from); }
  if (to) { conditions.push("event_date <= ?"); params.push(to); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const rows = db
    .prepare(`SELECT * FROM agenda_events ${where} ORDER BY event_date ASC, start_time ASC`)
    .all(...params);
  res.json({ data: rows });
});

// Próximos compromissos (para lembretes dentro do sistema)
router.get("/upcoming", requireAuth, (_req, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT * FROM agenda_events WHERE event_date >= ? AND event_date <= ?
       ORDER BY event_date ASC, start_time ASC LIMIT 20`
    )
    .all(today, in7);
  res.json({ data: rows });
});

// CRUD genérico por último, para não capturar /upcoming como /:id
router.use("/", base);

export default router;
