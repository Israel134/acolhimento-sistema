-- Sistema de Gestão de Acolhimento Hospitalar — schema relacional (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,          -- administrador | gestor | operacional
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  photo_url TEXT,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  sector TEXT,                        -- SEREC | SUAC | SETIP | SEPPERT | GERAL
  position TEXT,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | inativo
  theme_preference TEXT DEFAULT 'system', -- light | dark | system
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS collaborators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rh TEXT,
  registration TEXT,
  position TEXT,
  sector TEXT NOT NULL,
  admission_date TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rh TEXT,
  registration TEXT,
  position TEXT,
  sector TEXT NOT NULL,
  shift_type TEXT,                    -- plantao | diarista
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

-- Indicador 1 (SEREC): pacientes atendidos
CREATE TABLE IF NOT EXISTS serec_patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,          -- YYYY-MM-DD
  unit TEXT NOT NULL,
  category TEXT NOT NULL,             -- urgencia | ambulatorio | internados
  quantity INTEGER NOT NULL,
  observation TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador 4 (SUAC): feedbacks
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER REFERENCES managers(id),
  collaborator_id INTEGER REFERENCES collaborators(id),
  feedback_date TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- aceito | sem_aceite | pendente
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador 11 (SUAC): patrimônios
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patrimony_number TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  responsible TEXT,
  acquisition_date TEXT,
  status TEXT NOT NULL DEFAULT 'bom_estado', -- bom_estado|quebrado|chamado_aberto|resolvido|em_manutencao|baixado
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador 2 (SEREC): entradas (acompanhantes, visitantes e colaboradores)
CREATE TABLE IF NOT EXISTS serec_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,          -- YYYY-MM-DD
  unit TEXT NOT NULL,
  entry_type TEXT NOT NULL,           -- acompanhante | visitante | colaborador
  quantity INTEGER NOT NULL,
  observation TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador 3 (SEREC): tempo de atendimento da recepção (2 sub-indicadores)
CREATE TABLE IF NOT EXISTS serec_service_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,          -- YYYY-MM-DD
  unit TEXT NOT NULL,
  shift TEXT,                         -- manha | tarde | noite
  avg_wait_minutes REAL NOT NULL,     -- sub-indicador 1: tempo médio de espera
  avg_service_minutes REAL NOT NULL,  -- sub-indicador 2: tempo médio de atendimento
  observation TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador (SEREC): erros operacionais
CREATE TABLE IF NOT EXISTS serec_operational_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,          -- YYYY-MM-DD
  unit TEXT NOT NULL,
  collaborator_id INTEGER REFERENCES collaborators(id),
  error_type TEXT NOT NULL,           -- cadastro | documentacao | triagem | comunicacao | sistema | outro
  severity TEXT NOT NULL DEFAULT 'leve', -- leve | moderado | grave
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,               -- login|logout|create|update|delete
  module TEXT NOT NULL,
  record_id TEXT,
  old_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_serec_patients_date ON serec_patients(record_date);
CREATE INDEX IF NOT EXISTS idx_feedbacks_date ON feedbacks(feedback_date);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_serec_entries_date ON serec_entries(record_date);
CREATE INDEX IF NOT EXISTS idx_serec_service_times_date ON serec_service_times(record_date);
CREATE INDEX IF NOT EXISTS idx_serec_errors_date ON serec_operational_errors(record_date);
CREATE INDEX IF NOT EXISTS idx_serec_errors_collaborator ON serec_operational_errors(collaborator_id);
