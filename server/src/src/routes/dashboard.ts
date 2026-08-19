import { Router } from "express";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/summary", requireAuth, (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateCond = (col: string) => {
    const c: string[] = [];
    const p: any[] = [];
    if (from) { c.push(`${col} >= ?`); p.push(from); }
    if (to) { c.push(`${col} <= ?`); p.push(to); }
    return { where: c.length ? "WHERE " + c.join(" AND ") : "", params: p };
  };

  const patients = dateCond("record_date");
  const totalPatients = (db.prepare(`SELECT COALESCE(SUM(quantity),0) as t FROM serec_patients ${patients.where}`).get(...patients.params) as any).t;

  const fb = dateCond("feedback_date");
  const totalFeedbacks = (db.prepare(`SELECT COUNT(*) as c FROM feedbacks ${fb.where}`).get(...fb.params) as any).c;
  const feedbacksSemAceite = (db.prepare(`SELECT COUNT(*) as c FROM feedbacks ${fb.where ? fb.where + " AND status='sem_aceite'" : "WHERE status='sem_aceite'"}`).get(...fb.params) as any).c;

  const totalCollaborators = (db.prepare(`SELECT COUNT(*) as c FROM collaborators WHERE status='ativo'`).get() as any).c;
  const totalManagers = (db.prepare(`SELECT COUNT(*) as c FROM managers WHERE status='ativo'`).get() as any).c;

  const assetsTotal = (db.prepare(`SELECT COUNT(*) as c FROM assets`).get() as any).c;
  const assetsBroken = (db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status='quebrado'`).get() as any).c;

  const patientsByCategory = db
    .prepare(`SELECT category, SUM(quantity) as total FROM serec_patients ${patients.where} GROUP BY category`)
    .all(...patients.params);

  const patientsDaily = db
    .prepare(`SELECT record_date as date, SUM(quantity) as total FROM serec_patients ${patients.where} GROUP BY record_date ORDER BY record_date ASC`)
    .all(...patients.params);

  const feedbacksByStatus = db
    .prepare(`SELECT status, COUNT(*) as c FROM feedbacks ${fb.where} GROUP BY status`)
    .all(...fb.params);

  const assetsByStatus = db.prepare(`SELECT status, COUNT(*) as c FROM assets GROUP BY status`).all();

  res.json({
    cards: {
      totalPatients,
      totalFeedbacks,
      feedbacksSemAceite,
      totalCollaborators,
      totalManagers,
      assetsTotal,
      assetsBroken,
    },
    charts: { patientsByCategory, patientsDaily, feedbacksByStatus, assetsByStatus },
    generatedAt: new Date().toISOString(),
  });
});

export default router;
