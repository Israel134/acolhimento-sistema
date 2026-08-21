import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "data", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `user-${req.user!.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Envie um arquivo de imagem."));
    cb(null, true);
  },
});

router.put("/", requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  const { name, username, email, theme_preference } = req.body || {};
  try {
    db.prepare(
      `UPDATE users SET name = COALESCE(?,name), username = COALESCE(?,username), email = COALESCE(?,email),
       theme_preference = COALESCE(?,theme_preference), updated_at = datetime('now') WHERE id = ?`
    ).run(name, username, email, theme_preference, req.user!.id);
    const updated = db.prepare(`SELECT id, name, username, email, theme_preference FROM users WHERE id = ?`).get(req.user!.id);
    logAudit({ userId: req.user!.id, action: "update", module: "perfil", recordId: req.user!.id, oldData: existing, newData: updated });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: "Não foi possível atualizar. Usuário ou e-mail já em uso.", details: err.message });
  }
});

router.post("/photo", requireAuth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada." });
  const url = `/uploads/${req.file.filename}`;
  db.prepare(`UPDATE users SET photo_url = ?, updated_at = datetime('now') WHERE id = ?`).run(url, req.user!.id);
  logAudit({ userId: req.user!.id, action: "update", module: "perfil_foto", recordId: req.user!.id, newData: { photo_url: url } });
  res.json({ photo_url: url });
});

router.put("/password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
  }
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user!.id);
  logAudit({ userId: req.user!.id, action: "update", module: "perfil_senha", recordId: req.user!.id });
  res.json({ ok: true });
});

router.delete("/", requireAuth, (req, res) => {
  const { password, confirm } = req.body || {};
  if (confirm !== true && confirm !== "true") {
    return res.status(400).json({ error: "Confirmação obrigatória para excluir a conta." });
  }
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!password || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Senha incorreta." });
  }
  // Mantém histórico de lançamentos (created_by permanece), apenas inativa a conta
  db.prepare(`UPDATE users SET status = 'inativo', updated_at = datetime('now') WHERE id = ?`).run(req.user!.id);
  logAudit({ userId: req.user!.id, action: "delete", module: "perfil_conta", recordId: req.user!.id });
  res.json({ ok: true, message: "Conta desativada. Registros históricos foram preservados." });
});

export default router;
