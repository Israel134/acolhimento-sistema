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

-- Indicador (SETIP): transporte de pacientes
CREATE TABLE IF NOT EXISTS setip_transports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,          -- YYYY-MM-DD
  unit TEXT NOT NULL,
  collaborator_id INTEGER REFERENCES collaborators(id),
  quantity INTEGER NOT NULL,          -- quantidade de pacientes transportados
  transport_type TEXT,                -- maca | cadeira_rodas | leito | a_pe | outro
  observation TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indicador (SEPPERT): central de pertences (armários / fileiras / posições)
CREATE TABLE IF NOT EXISTS seppert_lockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit TEXT NOT NULL,                 -- IMDL | HPS 28 de Agosto
  armario INTEGER NOT NULL,           -- 1..4
  fileira INTEGER NOT NULL,           -- 1..4
  posicao INTEGER NOT NULL,           -- 1..16
  status TEXT NOT NULL DEFAULT 'livre', -- livre | ocupado
  patient_name TEXT,
  entry_date TEXT,
  exit_date TEXT,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (unit, armario, fileira, posicao)
);

-- SUAC: Treinamentos e Reuniões
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'reuniao', -- reuniao | treinamento
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,          -- YYYY-MM-DD
  meeting_time TEXT,                   -- HH:MM
  location TEXT,
  subject TEXT,
  description TEXT,
  manager_id INTEGER REFERENCES managers(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meeting_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  category TEXT,                       -- ata | lista_presenca | relatorio | material | outro
  filename TEXT NOT NULL,              -- nome do arquivo salvo em disco
  original_name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SUAC: Ouvidorias e Notificações
CREATE TABLE IF NOT EXISTS ombudsman (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_type TEXT NOT NULL DEFAULT 'ouvidoria', -- ouvidoria | notificacao
  number TEXT,                         -- número da ouvidoria/notificação
  occurrence_date TEXT NOT NULL,       -- data da ocorrência
  response_date TEXT,                  -- data da resposta
  sector TEXT,
  manager_id INTEGER REFERENCES managers(id),
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | respondida | encerrada
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
CREATE INDEX IF NOT EXISTS idx_setip_transports_date ON setip_transports(record_date);
CREATE INDEX IF NOT EXISTS idx_setip_transports_collaborator ON setip_transports(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_seppert_lockers_unit ON seppert_lockers(unit);
CREATE INDEX IF NOT EXISTS idx_seppert_lockers_status ON seppert_lockers(status);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_manager ON meetings(manager_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting ON meeting_attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ombudsman_type ON ombudsman(record_type);
CREATE INDEX IF NOT EXISTS idx_ombudsman_occurrence ON ombudsman(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_ombudsman_status ON ombudsman(status);
