import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db/connection";
import { logAudit } from "../utils/audit";
import { requireAuth } from "../middleware/auth";

const router = Router();

// simple in-memory rate limiter for login attempts per username/IP
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

router.post("/login", (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    return res.status(400).json({ error: "Informe usuário/e-mail e senha." });
  }
  const key = identifier.toLowerCase();
  if (rateLimited(key)) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE (u.username = ? OR u.email = ?)`
    )
    .get(identifier, identifier) as any;

  if (!user || user.status !== "ativo") {
    return res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  attempts.delete(key);

  const payload = { id: user.id, username: user.username, role: user.role_name, sector: user.sector };
  const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN as any) || "8h",
  });

  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
  logAudit({ userId: user.id, action: "login", module: "auth", recordId: user.id });

  const { password_hash, ...safeUser } = user;
  res.json({ token, user: { ...safeUser, role: user.role_name } });
});

router.post("/logout", requireAuth, (req, res) => {
  logAudit({ userId: req.user!.id, action: "logout", module: "auth", recordId: req.user!.id });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.email, u.photo_url, u.sector, u.position, u.status,
              u.theme_preference, u.created_at, u.last_login, r.name as role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
    )
    .get(req.user!.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json(user);
});

router.post("/forgot-password", (req, res) => {
  const { identifier } = req.body as { identifier?: string };
  if (!identifier) return res.status(400).json({ error: "Informe usuário ou e-mail." });
  const user = db
    .prepare(`SELECT id FROM users WHERE username = ? OR email = ?`)
    .get(identifier, identifier);
  // Não revelar se o usuário existe ou não (evita enumeração de contas)
  res.json({
    ok: true,
    message:
      "Se o usuário existir, um link de redefinição de senha foi enviado para o e-mail cadastrado (simulado nesta demonstração).",
  });
});

export default router;
