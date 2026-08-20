import { Router } from "express";
import db from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

// Deriva "atrasada": não concluída e com prazo vencido
function withDerived(row: any) {
  if (!row) return row;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = row.status !== "concluida" && row.due_date && row.due_date < today;
  return { ...row, overdue: !!overdue, effective_status: overdue ? "atrasada" : row.status };
}

// Admin vê tudo; demais perfis veem apenas as tarefas atribuídas a si
function scopeClause(req: any, params: any[]) {
  if (req.user.role === "administrador") return "";
  params.push(req.user.id);
  return "assigned_to = ?";
}

router.get("/", requireAuth, (req, res) => {
  const { search, page = "1", pageSize = "10", status } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  const scope = scopeClause(req, params);
  if (scope) conditions.push(scope);
  if (search) { conditions.push("(t.title LIKE ? OR t.description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  if (status) { conditions.push("t.status = ?"); params.push(status); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const total = (db.prepare(`SELECT COUNT(*) as c FROM tasks t ${where}`).get(...params) as any).c;
  const limit = Math.min(parseInt(pageSize) || 10, 200);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
  const rows = db
    .prepare(
      `SELECT t.*, u.name as assigned_name FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       ${where}
       ORDER BY (t.status='concluida') ASC,
         CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'moderada' THEN 2 ELSE 3 END ASC,
         t.due_date ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)
    .map(withDerived);
  res.json({ data: rows, total, page: Number(page), pageSize: limit });
});

router.post("/", requireAuth, requireRole("administrador"), (req, res) => {
  try {
    const { title, description, assigned_to, priority, due_date, observation } = req.body || {};
    if (!title) return res.status(400).json({ error: "Informe o título da tarefa." });
    const result = db
      .prepare(
        `INSERT INTO tasks (title, description, assigned_to, priority, due_date, observation, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(title, description || null, assigned_to || null, priority || "moderada", due_date || null, observation || null, req.user!.id);
    const created = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(result.lastInsertRowid);
    logAudit({ userId: req.user!.id, action: "create", module: "tarefas", recordId: result.lastInsertRowid as number, newData: created });
    res.status(201).json(withDerived(created));
  } catch (err: any) {
    console.error("[tasks] Falha ao criar:", err);
    res.status(500).json({ error: "Erro interno do servidor ao criar a tarefa.", details: err?.message });
  }
});

router.put("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Tarefa não encontrada." });
    const { title, description, assigned_to, priority, due_date, status, observation } = req.body || {};
    const completedExpr = status === "concluida" ? "datetime('now')" : status ? "NULL" : "completed_at";
    db.prepare(
      `UPDATE tasks SET title=COALESCE(?,title), description=?, assigned_to=?, priority=COALESCE(?,priority),
       due_date=?, status=COALESCE(?,status), observation=?, completed_at=${completedExpr},
       updated_at=datetime('now') WHERE id=?`
    ).run(title, description || null, assigned_to || null, priority, due_date || null, status, observation || null, req.params.id);
    const updated = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "tarefas", recordId: req.params.id, oldData: existing, newData: updated });
    res.json(withDerived(updated));
  } catch (err: any) {
    console.error("[tasks] Falha ao atualizar:", err);
    res.status(500).json({ error: "Erro interno do servidor ao atualizar a tarefa.", details: err?.message });
  }
});

// Atualização de status: admin em qualquer tarefa; responsável (gestor/operacional) apenas nas suas
router.patch("/:id/status", requireAuth, (req, res) => {
  try {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id) as any;
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada." });
    const isAdmin = req.user!.role === "administrador";
    const isOwner = task.assigned_to === req.user!.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Você só pode atualizar o status das tarefas atribuídas a você." });
    }
    const { status } = req.body || {};
    const valid = ["pendente", "em_andamento", "concluida"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Status inválido." });
    const completed = status === "concluida" ? "datetime('now')" : "NULL";
    db.prepare(`UPDATE tasks SET status = ?, completed_at = ${completed}, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
    const updated = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user!.id, action: "update", module: "tarefas_status", recordId: req.params.id, oldData: { status: task.status }, newData: { status } });
    res.json(withDerived(updated));
  } catch (err: any) {
    console.error("[tasks] Falha ao atualizar status:", err);
    res.status(500).json({ error: "Erro interno do servidor ao atualizar o status.", details: err?.message });
  }
});

router.delete("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Tarefa não encontrada." });
    db.prepare(`DELETE FROM tasks WHERE id = ?`).run(req.params.id);
    logAudit({ userId: req.user!.id, action: "delete", module: "tarefas", recordId: req.params.id, oldData: existing });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[tasks] Falha ao excluir:", err);
    res.status(500).json({ error: "Erro interno do servidor ao excluir a tarefa.", details: err?.message });
  }
});

router.get("/agg/summary", requireAuth, (req, res) => {
  const params: any[] = [];
  const scope = scopeClause(req, params);
  const where = scope ? `WHERE ${scope}` : "";
  const today = new Date().toISOString().slice(0, 10);

  const total = (db.prepare(`SELECT COUNT(*) as c FROM tasks ${where}`).get(...params) as any).c;
  const concluidas = (db.prepare(`SELECT COUNT(*) as c FROM tasks ${where}${where ? " AND" : "WHERE"} status='concluida'`).get(...params) as any).c;
  const pendentes = (db.prepare(`SELECT COUNT(*) as c FROM tasks ${where}${where ? " AND" : "WHERE"} status!='concluida'`).get(...params) as any).c;
  const atrasadas = (db.prepare(`SELECT COUNT(*) as c FROM tasks ${where}${where ? " AND" : "WHERE"} status!='concluida' AND due_date IS NOT NULL AND due_date < ?`).get(...params, today) as any).c;
  const byPriority = db.prepare(`SELECT priority, COUNT(*) as c FROM tasks ${where} GROUP BY priority`).all(...params);
  const byStatus = db.prepare(`SELECT status, COUNT(*) as c FROM tasks ${where} GROUP BY status`).all(...params);
  const ranking = db
    .prepare(
      `SELECT u.name as responsible, COUNT(*) as c FROM tasks t
       JOIN users u ON u.id = t.assigned_to ${where ? where.replace("assigned_to", "t.assigned_to") + " AND" : "WHERE"} t.assigned_to IS NOT NULL
       GROUP BY t.assigned_to ORDER BY c DESC LIMIT 15`
    )
    .all(...params);

  res.json({ total, concluidas, pendentes, atrasadas, byPriority, byStatus, ranking });
});

export default router;
