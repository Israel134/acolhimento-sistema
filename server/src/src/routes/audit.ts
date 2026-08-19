import { Router } from "express";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRole("administrador"), (req, res) => {
  const { module, action, from, to, page = "1", pageSize = "30" } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (module) { conditions.push("a.module = ?"); params.push(module); }
  if (action) { conditions.push("a.action = ?"); params.push(action); }
  if (from) { conditions.push("date(a.created_at) >= ?"); params.push(from); }
  if (to) { conditions.push("date(a.created_at) <= ?"); params.push(to); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const limit = Math.min(parseInt(pageSize) || 30, 200);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs a ${where}`).get(...params) as any).c;
  const rows = db
    .prepare(
      `SELECT a.*, u.name as user_name FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  res.json({ data: rows, total, page: Number(page), pageSize: limit });
});

export default router;
