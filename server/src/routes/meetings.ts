import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "data", "uploads", "meetings");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = `meeting-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB por arquivo
});

const WRITE_ROLES = ["administrador", "gestor"];

// Lista reuniões/treinamentos com filtros e paginação
router.get("/", requireAuth, (req, res) => {
  const { search, page = "1", pageSize = "10", kind, manager_id } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (search) { conditions.push("(m.title LIKE ? OR m.subject LIKE ? OR m.location LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (kind) { conditions.push("m.kind = ?"); params.push(kind); }
  if (manager_id) { conditions.push("m.manager_id = ?"); params.push(Number(manager_id)); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const total = (db.prepare(`SELECT COUNT(*) as c FROM meetings m ${where}`).get(...params) as any).c;
  const limit = Math.min(parseInt(pageSize) || 10, 200);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
  const rows = db
    .prepare(
      `SELECT m.*, mg.name as manager_name,
        (SELECT COUNT(*) FROM meeting_attachments a WHERE a.meeting_id = m.id) as attachment_count
       FROM meetings m
       LEFT JOIN managers mg ON mg.id = m.manager_id
       ${where}
       ORDER BY m.meeting_date DESC, m.meeting_time DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  res.json({ data: rows, total, page: Number(page), pageSize: limit });
});

// Detalhe com anexos
router.get("/:id", requireAuth, (req, res) => {
  const meeting = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Registro não encontrado." });
  const attachments = db.prepare(`SELECT * FROM meeting_attachments WHERE meeting_id = ? ORDER BY created_at DESC`).all(req.params.id);
  res.json({ ...meeting, attachments });
});

router.post("/", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  try {
    const { kind, title, meeting_date, meeting_time, location, subject, description, manager_id } = req.body || {};
    if (!title || !meeting_date) return res.status(400).json({ error: "Informe ao menos o assunto/título e a data." });
    const result = db
      .prepare(
        `INSERT INTO meetings (kind, title, meeting_date, meeting_time, location, subject, description, manager_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(kind || "reuniao", title, meeting_date, meeting_time || null, location || null, subject || null, description || null, manager_id || null, req.user!.id);
    const created = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(result.lastInsertRowid);
    logAudit({ userId: req.user!.id, action: "create", module: "reunioes", recordId: result.lastInsertRowid as number, newData: created });
    res.status(201).json(created);
  } catch (err: any) {
    console.error("[meetings] Falha ao criar:", err);
    res.status(500).json({ error: "Erro interno do servidor ao salvar a reunião.", details: err?.message });
  }
});

router.put("/:id", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
    const { kind, title, meeting_date, meeting_time, location, subject, description, manager_id } = req.body || {};
    db.prepare(
      `UPDATE meetings SET kind=COALESCE(?,kind), title=COALESCE(?,title), meeting_date=COALESCE(?,meeting_date),
       meeting_time=?, location=?, subject=?, description=?, manager_id=?, updated_at=datetime('now') WHERE id=?`
    ).run(kind, title, meeting_date, meeting_time || null, location || null, subject || null, description || null, manager_id || null, req.params.id);
    const updated = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "reunioes", recordId: req.params.id, oldData: existing, newData: updated });
    res.json(updated);
  } catch (err: any) {
    console.error("[meetings] Falha ao atualizar:", err);
    res.status(500).json({ error: "Erro interno do servidor ao atualizar a reunião.", details: err?.message });
  }
});

router.delete("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
    // remove arquivos físicos dos anexos
    const attachments = db.prepare(`SELECT * FROM meeting_attachments WHERE meeting_id = ?`).all(req.params.id) as any[];
    attachments.forEach((a) => {
      const fp = path.join(uploadDir, a.filename);
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch { /* ignora */ } }
    });
    db.prepare(`DELETE FROM meeting_attachments WHERE meeting_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM meetings WHERE id = ?`).run(req.params.id);
    logAudit({ userId: req.user!.id, action: "delete", module: "reunioes", recordId: req.params.id, oldData: existing });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[meetings] Falha ao excluir:", err);
    res.status(500).json({ error: "Erro interno do servidor ao excluir a reunião.", details: err?.message });
  }
});

// Upload de anexo
router.post("/:id/attachments", requireAuth, requireRole(...WRITE_ROLES), upload.single("file"), (req, res) => {
  try {
    const meeting = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Reunião não encontrada." });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const url = `/uploads/meetings/${req.file.filename}`;
    const result = db
      .prepare(
        `INSERT INTO meeting_attachments (meeting_id, category, filename, original_name, url, mime_type, size, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.params.id, req.body.category || "outro", req.file.filename, req.file.originalname, url, req.file.mimetype, req.file.size, req.user!.id);
    const created = db.prepare(`SELECT * FROM meeting_attachments WHERE id = ?`).get(result.lastInsertRowid);
    logAudit({ userId: req.user!.id, action: "create", module: "reunioes_anexo", recordId: req.params.id, newData: { file: req.file.originalname } });
    res.status(201).json(created);
  } catch (err: any) {
    console.error("[meetings] Falha no upload:", err);
    res.status(500).json({ error: "Erro interno do servidor ao enviar o anexo.", details: err?.message });
  }
});

router.delete("/:id/attachments/:attId", requireAuth, requireRole(...WRITE_ROLES), (req, res) => {
  try {
    const att = db.prepare(`SELECT * FROM meeting_attachments WHERE id = ? AND meeting_id = ?`).get(req.params.attId, req.params.id) as any;
    if (!att) return res.status(404).json({ error: "Anexo não encontrado." });
    const fp = path.join(uploadDir, att.filename);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch { /* ignora */ } }
    db.prepare(`DELETE FROM meeting_attachments WHERE id = ?`).run(req.params.attId);
    logAudit({ userId: req.user!.id, action: "delete", module: "reunioes_anexo", recordId: req.params.id, oldData: { file: att.original_name } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[meetings] Falha ao excluir anexo:", err);
    res.status(500).json({ error: "Erro interno do servidor ao excluir o anexo.", details: err?.message });
  }
});

// Dashboard
router.get("/agg/summary", requireAuth, (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (from) { conditions.push("m.meeting_date >= ?"); params.push(from); }
  if (to) { conditions.push("m.meeting_date <= ?"); params.push(to); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COUNT(*) as c FROM meetings m ${where}`).get(...params) as any).c;
  const byManager = db
    .prepare(
      `SELECT mg.name as manager, COUNT(*) as c FROM meetings m
       JOIN managers mg ON mg.id = m.manager_id ${where ? where.replace("WHERE", "AND") : ""}
       GROUP BY m.manager_id ORDER BY c DESC LIMIT 15`
    )
    .all(...params);
  const byMonth = db
    .prepare(`SELECT strftime('%Y-%m', m.meeting_date) as month, COUNT(*) as c FROM meetings m ${where} GROUP BY month ORDER BY month ASC`)
    .all(...params);
  const byWeek = db
    .prepare(`SELECT strftime('%Y-W%W', m.meeting_date) as week, COUNT(*) as c FROM meetings m ${where} GROUP BY week ORDER BY week ASC`)
    .all(...params);
  const byKind = db
    .prepare(`SELECT m.kind, COUNT(*) as c FROM meetings m ${where} GROUP BY m.kind`)
    .all(...params);

  res.json({ total, byManager, byMonth, byWeek, byKind });
});

export default router;
