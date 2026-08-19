import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/agg/summary", requireAuth, (_req, res) => {
  const total = (db.prepare(`SELECT COUNT(*) as c FROM assets`).get() as any).c;
  const byStatus = db.prepare(`SELECT status, COUNT(*) as c FROM assets GROUP BY status`).all();
  const byCategory = db.prepare(`SELECT category, COUNT(*) as c FROM assets GROUP BY category ORDER BY c DESC`).all();
  res.json({ total, byStatus, byCategory });
});

export default router;
