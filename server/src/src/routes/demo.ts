import { Router } from "express";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

// Remove somente os dados fictícios de demonstração (mantém usuários e cadastros essenciais)
router.post("/clear", requireAuth, requireRole("administrador"), (req, res) => {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM serec_patients`).run();
    db.prepare(`DELETE FROM serec_entries`).run();
    db.prepare(`DELETE FROM serec_service_times`).run();
    db.prepare(`DELETE FROM serec_operational_errors`).run();
    db.prepare(`DELETE FROM feedbacks`).run();
    db.prepare(`DELETE FROM assets`).run();
    db.prepare(`DELETE FROM collaborators`).run();
    db.prepare(`DELETE FROM managers`).run();
  });
  tx();
  logAudit({ userId: req.user!.id, action: "delete", module: "dados_demo", recordId: null });
  res.json({ ok: true, message: "Dados de demonstração removidos com sucesso." });
});

export default router;
