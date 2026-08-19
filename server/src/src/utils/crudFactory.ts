import { Router, Request, Response } from "express";
import db from "../db/connection";
import { logAudit } from "../utils/audit";
import { requireAuth, requireRole } from "../middleware/auth";

interface CrudOptions {
  table: string;
  module: string;
  allowedFields: string[];
  searchFields?: string[];
  defaultOrder?: string;
  writeRoles?: string[]; // roles allowed to create/update
  deleteRoles?: string[]; // roles allowed to delete
  beforeCreate?: (body: any, req: Request) => any;
}

export function buildCrudRouter(opts: CrudOptions) {
  const router = Router();
  const writeRoles = opts.writeRoles || ["administrador", "gestor", "operacional"];
  const deleteRoles = opts.deleteRoles || ["administrador"];

  router.get("/", requireAuth, (req: Request, res: Response) => {
    const { search, page = "1", pageSize = "20", sort, order = "asc" } = req.query as Record<string, string>;
    let where = "";
    const params: any[] = [];
    if (search && opts.searchFields?.length) {
      where =
        "WHERE " + opts.searchFields.map((f) => `${f} LIKE ?`).join(" OR ");
      opts.searchFields.forEach(() => params.push(`%${search}%`));
    }
    const total = (db.prepare(`SELECT COUNT(*) as c FROM ${opts.table} ${where}`).get(...params) as any).c;
    const orderBy = sort && opts.allowedFields.includes(sort) ? sort : opts.defaultOrder || "id";
    const dir = order === "desc" ? "DESC" : "ASC";
    const limit = Math.min(parseInt(pageSize) || 20, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
    const rows = db
      .prepare(`SELECT * FROM ${opts.table} ${where} ORDER BY ${orderBy} ${dir} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    res.json({ data: rows, total, page: Number(page), pageSize: limit });
  });

  router.get("/:id", requireAuth, (req: Request, res: Response) => {
    const row = db.prepare(`SELECT * FROM ${opts.table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: "Registro não encontrado." });
    res.json(row);
  });

  router.post("/", requireAuth, requireRole(...writeRoles), (req: Request, res: Response) => {
    let body = req.body || {};
    if (opts.beforeCreate) body = opts.beforeCreate(body, req);
    const fields = opts.allowedFields.filter((f) => body[f] !== undefined);
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo válido enviado." });
    const cols = [...fields, "created_by"];
    const placeholders = cols.map(() => "?").join(",");
    const values = [...fields.map((f) => body[f]), req.user!.id];
    try {
      const result = db
        .prepare(`INSERT INTO ${opts.table} (${cols.join(",")}) VALUES (${placeholders})`)
        .run(...values);
      const created = db.prepare(`SELECT * FROM ${opts.table} WHERE id = ?`).get(result.lastInsertRowid);
      logAudit({
        userId: req.user!.id,
        action: "create",
        module: opts.module,
        recordId: result.lastInsertRowid as number,
        newData: created,
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error(`[crudFactory] Falha ao criar registro em "${opts.table}":`, err);
      if (err?.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint failed/i.test(err?.message || "")) {
        return res.status(409).json({ error: "Já existe um registro com esses dados (valor duplicado).", code: "UNIQUE_CONSTRAINT" });
      }
      res.status(400).json({ error: "Erro ao salvar registro.", details: err.message });
    }
  });

  router.put("/:id", requireAuth, requireRole(...writeRoles), (req: Request, res: Response) => {
    const existing = db.prepare(`SELECT * FROM ${opts.table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
    const body = req.body || {};
    const fields = opts.allowedFields.filter((f) => body[f] !== undefined);
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo válido enviado." });
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => body[f]);
    try {
      db.prepare(`UPDATE ${opts.table} SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(
        ...values,
        req.params.id
      );
      const updated = db.prepare(`SELECT * FROM ${opts.table} WHERE id = ?`).get(req.params.id);
      logAudit({
        userId: req.user!.id,
        action: "update",
        module: opts.module,
        recordId: req.params.id,
        oldData: existing,
        newData: updated,
      });
      res.json(updated);
    } catch (err: any) {
      console.error(`[crudFactory] Falha ao atualizar registro em "${opts.table}" (id=${req.params.id}):`, err);
      if (err?.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint failed/i.test(err?.message || "")) {
        return res.status(409).json({ error: "Já existe um registro com esses dados (valor duplicado).", code: "UNIQUE_CONSTRAINT" });
      }
      if (
        err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
        err?.code === "SQLITE_CONSTRAINT" ||
        /FOREIGN KEY constraint failed/i.test(err?.message || "")
      ) {
        return res.status(409).json({ error: "Não é possível salvar: referência inválida a outro registro.", code: "FK_CONSTRAINT" });
      }
      res.status(400).json({ error: "Erro ao atualizar registro.", details: err.message });
    }
  });

  router.delete("/:id", requireAuth, requireRole(...deleteRoles), (req: Request, res: Response) => {
    try {
      const existing = db.prepare(`SELECT * FROM ${opts.table} WHERE id = ?`).get(req.params.id);
      if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
      db.prepare(`DELETE FROM ${opts.table} WHERE id = ?`).run(req.params.id);
      logAudit({
        userId: req.user!.id,
        action: "delete",
        module: opts.module,
        recordId: req.params.id,
        oldData: existing,
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error(`[crudFactory] Falha ao excluir registro em "${opts.table}" (id=${req.params.id}):`, err);
      if (
        err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
        err?.code === "SQLITE_CONSTRAINT" ||
        /FOREIGN KEY constraint failed/i.test(err?.message || "")
      ) {
        return res.status(409).json({
          error:
            "Não é possível excluir este registro porque existem outros registros vinculados a ele (ex: feedbacks, lançamentos ou históricos). Remova ou reatribua esses vínculos antes de excluir.",
          code: "FK_CONSTRAINT",
        });
      }
      res.status(500).json({ error: "Erro interno do servidor ao excluir o registro.", details: err?.message });
    }
  });

  return router;
}
