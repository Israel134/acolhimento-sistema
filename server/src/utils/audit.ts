import db from "../db/connection";

export function logAudit(params: {
  userId: number | null;
  action: "login" | "logout" | "create" | "update" | "delete";
  module: string;
  recordId?: string | number | null;
  oldData?: any;
  newData?: any;
}) {
  const stmt = db.prepare(
    `INSERT INTO audit_logs (user_id, action, module, record_id, old_data, new_data)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    params.userId,
    params.action,
    params.module,
    params.recordId != null ? String(params.recordId) : null,
    params.oldData != null ? JSON.stringify(params.oldData) : null,
    params.newData != null ? JSON.stringify(params.newData) : null
  );
}
