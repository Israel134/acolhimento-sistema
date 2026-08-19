import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

router.get("/", requireAuth, requireRole("administrador"), (req, res) => {
  const { search = "" } = req.query as Record<string, string>;
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.email, u.photo_url, u.sector, u.position, u.status,
              u.created_at, u.last_login, r.name as role, r.id as role_id
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?
       ORDER BY u.name ASC`
    )
    .all(`%${search}%`, `%${search}%`, `%${search}%`);
  res.json({ data: rows, total: rows.length });
});

router.get("/roles", requireAuth, (_req, res) => {
  res.json(db.prepare(`SELECT * FROM roles ORDER BY id`).all());
});

router.post("/", requireAuth, requireRole("administrador"), (req, res) => {
  const { name, username, email, password, role_id, sector, position, status } = req.body || {};
  if (!name || !username || !email || !password || !role_id) {
    return res.status(400).json({ error: "Preencha nome, usuário, e-mail, senha e perfil de acesso." });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db
      .prepare(
        `INSERT INTO users (name, username, email, password_hash, role_id, sector, position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, username, email, hash, role_id, sector || null, position || null, status || "ativo");
    const created = db.prepare(`SELECT id, name, username, email, sector, position, status FROM users WHERE id = ?`).get(result.lastInsertRowid);
    logAudit({ userId: req.user!.id, action: "create", module: "usuarios", recordId: result.lastInsertRowid as number, newData: created });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: "Usuário ou e-mail já cadastrado.", details: err.message });
  }
});

router.put("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
    const { name, username, email, role_id, sector, position, status } = req.body || {};
    db.prepare(
      `UPDATE users SET name = COALESCE(?,name), username = COALESCE(?,username), email = COALESCE(?,email),
       role_id = COALESCE(?,role_id), sector = COALESCE(?,sector), position = COALESCE(?,position),
       status = COALESCE(?,status), updated_at = datetime('now') WHERE id = ?`
    ).run(name, username, email, role_id, sector, position, status, req.params.id);
    const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "usuarios", recordId: req.params.id, oldData: existing, newData: updated });
    res.json(updated);
  } catch (err: any) {
    console.error(`[users] Falha ao atualizar usuário (id=${req.params.id}):`, err);
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint failed/i.test(err?.message || "")) {
      return res.status(409).json({ error: "Nome de usuário ou e-mail já está em uso por outra conta.", code: "UNIQUE_CONSTRAINT" });
    }
    res.status(500).json({ error: "Erro interno do servidor ao atualizar o usuário.", details: err?.message });
  }
});

router.delete("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ error: "Você não pode excluir seu próprio usuário por aqui. Use 'Excluir conta' no Perfil." });
  }
  try {
    const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
    db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
    logAudit({ userId: req.user!.id, action: "delete", module: "usuarios", recordId: req.params.id, oldData: existing });
    res.json({ ok: true });
  } catch (err: any) {
    console.error(`[users] Falha ao excluir usuário (id=${req.params.id}):`, err);
    if (
      err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
      err?.code === "SQLITE_CONSTRAINT" ||
      /FOREIGN KEY constraint failed/i.test(err?.message || "")
    ) {
      // Usuário possui lançamentos vinculados (created_by) — inativar preserva o histórico.
      db.prepare(`UPDATE users SET status = 'inativo', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
      logAudit({ userId: req.user!.id, action: "update", module: "usuarios", recordId: req.params.id, newData: { status: "inativo" } });
      return res.status(200).json({
        ok: true,
        message:
          "Este usuário possui registros vinculados (lançamentos, auditoria etc.) e não pode ser excluído permanentemente. A conta foi desativada e o histórico foi preservado.",
        deactivated: true,
      });
    }
    res.status(500).json({ error: "Erro interno do servidor ao excluir o usuário.", details: err?.message });
  }
});

export default router;
