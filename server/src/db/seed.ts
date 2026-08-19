import bcrypt from "bcryptjs";
import db from "./connection";

const UNITS = ["IMDL", "HPS 28 de Agosto"];
const CATEGORIES = ["urgencia", "ambulatorio", "internados"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function seed() {
  const rolesCount = (db.prepare(`SELECT COUNT(*) as c FROM roles`).get() as any).c;
  if (rolesCount === 0) {
    const insertRole = db.prepare(`INSERT INTO roles (name, description) VALUES (?, ?)`);
    insertRole.run("administrador", "Acesso total ao sistema");
    insertRole.run("gestor", "Lança dados, visualiza dashboards e gerencia sua equipe");
    insertRole.run("operacional", "Lança dados autorizados e consulta indicadores");
  }

  const roleAdmin = (db.prepare(`SELECT id FROM roles WHERE name='administrador'`).get() as any).id;
  const roleGestor = (db.prepare(`SELECT id FROM roles WHERE name='gestor'`).get() as any).id;
  const roleOperacional = (db.prepare(`SELECT id FROM roles WHERE name='operacional'`).get() as any).id;

  const usersCount = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  if (usersCount === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users (name, username, email, password_hash, role_id, sector, position, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')`
    );
    const pass = bcrypt.hashSync("Acolher@123", 10);
    insertUser.run("Administrador do Sistema", "admin", "admin@acolhimento.local", pass, roleAdmin, "GERAL", "Administrador de TI");
    insertUser.run("Ana Beatriz Souza", "ana.souza", "ana.souza@acolhimento.local", pass, roleGestor, "SUAC", "Gestora SUAC");
    insertUser.run("Carlos Eduardo Lima", "carlos.lima", "carlos.lima@acolhimento.local", pass, roleOperacional, "SEREC", "Recepcionista");
    console.log("Usuários demo criados. Login: admin / ana.souza / carlos.lima  Senha: Acolher@123");
  }

  const adminId = (db.prepare(`SELECT id FROM users WHERE username='admin'`).get() as any).id;

  const collabCount = (db.prepare(`SELECT COUNT(*) as c FROM collaborators`).get() as any).c;
  if (collabCount === 0) {
    const insertCollab = db.prepare(
      `INSERT INTO collaborators (name, rh, registration, position, sector, admission_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)`
    );
    const names = [
      "Mariana Alves", "João Pedro Costa", "Fernanda Rocha", "Ricardo Nunes", "Patrícia Gomes",
      "Bruno Cardoso", "Juliana Martins", "Eduardo Ferreira", "Camila Dias", "Lucas Barbosa",
    ];
    const sectors = ["SEREC", "SUAC", "SETIP", "SEPPERT"];
    names.forEach((name, i) => {
      insertCollab.run(
        name,
        String(10000 + i),
        `MAT-${2000 + i}`,
        "Assistente",
        sectors[i % sectors.length],
        dateStr(new Date(2023, i % 12, 10)),
        adminId
      );
    });
  }

  const managersCount = (db.prepare(`SELECT COUNT(*) as c FROM managers`).get() as any).c;
  if (managersCount === 0) {
    const insertManager = db.prepare(
      `INSERT INTO managers (name, rh, registration, position, sector, shift_type, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)`
    );
    const managers = [
      ["Ana Beatriz Souza", "SUAC", "diarista"],
      ["Marcos Vinícius Teixeira", "SEREC", "plantao"],
      ["Renata Oliveira", "SETIP", "diarista"],
      ["Felipe Andrade", "SEPPERT", "plantao"],
    ];
    managers.forEach(([name, sector, shift], i) => {
      insertManager.run(name, String(20000 + i), `GES-${3000 + i}`, "Coordenador(a)", sector, shift, adminId);
    });
  }

  const patientsCount = (db.prepare(`SELECT COUNT(*) as c FROM serec_patients`).get() as any).c;
  if (patientsCount === 0) {
    const insertPatient = db.prepare(
      `INSERT INTO serec_patients (record_date, unit, category, quantity, observation, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = dateStr(d);
      UNITS.forEach((unit) => {
        CATEGORIES.forEach((cat) => {
          const base = cat === "urgencia" ? 25 : cat === "ambulatorio" ? 15 : 8;
          const qty = randInt(Math.max(1, base - 6), base + 10);
          insertPatient.run(ds, unit, cat, qty, null, adminId);
        });
      });
    }
  }

  const entriesCount = (db.prepare(`SELECT COUNT(*) as c FROM serec_entries`).get() as any).c;
  if (entriesCount === 0) {
    const insertEntry = db.prepare(
      `INSERT INTO serec_entries (record_date, unit, entry_type, quantity, observation, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const entryTypes = ["acompanhante", "visitante", "colaborador"];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = dateStr(d);
      UNITS.forEach((unit) => {
        entryTypes.forEach((type) => {
          const base = type === "acompanhante" ? 20 : type === "visitante" ? 12 : 6;
          const qty = randInt(Math.max(1, base - 5), base + 8);
          insertEntry.run(ds, unit, type, qty, null, adminId);
        });
      });
    }
  }

  const serviceTimesCount = (db.prepare(`SELECT COUNT(*) as c FROM serec_service_times`).get() as any).c;
  if (serviceTimesCount === 0) {
    const insertServiceTime = db.prepare(
      `INSERT INTO serec_service_times (record_date, unit, shift, avg_wait_minutes, avg_service_minutes, observation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const shifts = ["manha", "tarde", "noite"];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = dateStr(d);
      UNITS.forEach((unit) => {
        shifts.forEach((shift) => {
          const wait = randInt(4, 22);
          const service = randInt(6, 30);
          insertServiceTime.run(ds, unit, shift, wait, service, null, adminId);
        });
      });
    }
  }

  const errorsCount = (db.prepare(`SELECT COUNT(*) as c FROM serec_operational_errors`).get() as any).c;
  if (errorsCount === 0) {
    const collabIdsForErrors = db.prepare(`SELECT id FROM collaborators`).all() as any[];
    const insertError = db.prepare(
      `INSERT INTO serec_operational_errors (record_date, unit, collaborator_id, error_type, severity, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const errorTypes = ["cadastro", "documentacao", "triagem", "comunicacao", "sistema", "outro"];
    const severities = ["leve", "moderado", "grave"];
    const today = new Date();
    for (let i = 0; i < 40; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 59));
      const collab = collabIdsForErrors[randInt(0, collabIdsForErrors.length - 1)];
      insertError.run(
        dateStr(d),
        UNITS[randInt(0, UNITS.length - 1)],
        collab.id,
        errorTypes[randInt(0, errorTypes.length - 1)],
        severities[randInt(0, severities.length - 1)],
        "Registro de demonstração gerado automaticamente.",
        adminId
      );
    }
  }

  const setipCount = (db.prepare(`SELECT COUNT(*) as c FROM setip_transports`).get() as any).c;
  if (setipCount === 0) {
    const collabIdsForSetip = db.prepare(`SELECT id FROM collaborators`).all() as any[];
    const insertTransport = db.prepare(
      `INSERT INTO setip_transports (record_date, unit, collaborator_id, quantity, transport_type, observation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const transportTypes = ["maca", "cadeira_rodas", "leito", "a_pe", "outro"];
    const today = new Date();
    for (let i = 0; i < 120; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 120));
      const collab = collabIdsForSetip[randInt(0, collabIdsForSetip.length - 1)];
      insertTransport.run(
        dateStr(d),
        UNITS[randInt(0, UNITS.length - 1)],
        collab.id,
        randInt(1, 8),
        transportTypes[randInt(0, transportTypes.length - 1)],
        null,
        adminId
      );
    }
  }

  // SEPPERT: garante a grade fixa e ocupa algumas posições de demonstração
  const seppertUnits = ["IMDL", "HPS 28 de Agosto"];
  const seppertCount = (db.prepare(`SELECT COUNT(*) as c FROM seppert_lockers`).get() as any).c;
  if (seppertCount === 0) {
    const insertLocker = db.prepare(
      `INSERT OR IGNORE INTO seppert_lockers (unit, armario, fileira, posicao, status) VALUES (?, ?, ?, ?, 'livre')`
    );
    for (const unit of seppertUnits) {
      for (let a = 1; a <= 4; a++) {
        for (let f = 1; f <= 4; f++) {
          for (let p = 1; p <= 16; p++) {
            insertLocker.run(unit, a, f, p);
          }
        }
      }
    }
  }
  const occupiedCount = (db.prepare(`SELECT COUNT(*) as c FROM seppert_lockers WHERE status='ocupado'`).get() as any).c;
  if (occupiedCount === 0) {
    const freePositions = db.prepare(`SELECT id FROM seppert_lockers WHERE status='livre' ORDER BY id`).all() as any[];
    const patients = [
      "José da Silva", "Maria Oliveira", "Antônio Souza", "Francisca Lima", "João Santos",
      "Ana Costa", "Pedro Almeida", "Rita Pereira", "Carlos Rodrigues", "Sandra Nascimento",
      "Paulo Ferreira", "Luzia Araújo", "Marcos Ribeiro", "Teresa Gomes", "Sebastião Martins",
    ];
    const today = new Date();
    patients.forEach((name, i) => {
      const pos = freePositions[randInt(0, freePositions.length - 1)];
      if (!pos) return;
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 20));
      db.prepare(
        `UPDATE seppert_lockers SET status='ocupado', patient_name=?, entry_date=?, description=?, updated_by=? WHERE id=?`
      ).run(name, dateStr(d), "Pertences de demonstração (mochila, documentos).", adminId, pos.id);
    });
  }

  const meetingsCount = (db.prepare(`SELECT COUNT(*) as c FROM meetings`).get() as any).c;
  if (meetingsCount === 0) {
    const managerIdsForMeet = db.prepare(`SELECT id FROM managers`).all() as any[];
    const insertMeeting = db.prepare(
      `INSERT INTO meetings (kind, title, meeting_date, meeting_time, location, subject, description, manager_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const kinds = ["reuniao", "treinamento"];
    const titles = ["Alinhamento mensal", "Treinamento de acolhimento", "Reunião de indicadores", "Capacitação de equipe", "Reunião de feedbacks", "Planejamento semanal"];
    const locais = ["Sala 1 - IMDL", "Auditório HPS", "Sala de reuniões SUAC", "Online"];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 90));
      const mgr = managerIdsForMeet[randInt(0, managerIdsForMeet.length - 1)];
      insertMeeting.run(
        kinds[randInt(0, 1)],
        titles[randInt(0, titles.length - 1)],
        dateStr(d),
        `${String(randInt(8, 17)).padStart(2, "0")}:00`,
        locais[randInt(0, locais.length - 1)],
        "Assunto de demonstração",
        "Registro de demonstração gerado automaticamente.",
        mgr.id,
        adminId
      );
    }
  }

  const ombudsmanCount = (db.prepare(`SELECT COUNT(*) as c FROM ombudsman`).get() as any).c;
  if (ombudsmanCount === 0) {
    const managerIdsForOmb = db.prepare(`SELECT id FROM managers`).all() as any[];
    const insertOmb = db.prepare(
      `INSERT INTO ombudsman (record_type, number, occurrence_date, response_date, sector, manager_id, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const types = ["ouvidoria", "notificacao"];
    const sectors = ["SEREC", "SUAC", "SETIP", "SEPPERT", "GERAL"];
    const statuses = ["pendente", "respondida", "encerrada"];
    const today = new Date();
    for (let i = 0; i < 50; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 120));
      const status = statuses[randInt(0, statuses.length - 1)];
      let responseDate: string | null = null;
      if (status !== "pendente") {
        const rd = new Date(d);
        rd.setDate(rd.getDate() + randInt(1, 15));
        responseDate = dateStr(rd);
      }
      const mgr = managerIdsForOmb[randInt(0, managerIdsForOmb.length - 1)];
      insertOmb.run(
        types[randInt(0, 1)],
        `${d.getFullYear()}-${String(1000 + i)}`,
        dateStr(d),
        responseDate,
        sectors[randInt(0, sectors.length - 1)],
        mgr.id,
        status,
        "Registro de demonstração gerado automaticamente.",
        adminId
      );
    }
  }

  const feedbackCount = (db.prepare(`SELECT COUNT(*) as c FROM feedbacks`).get() as any).c;
  if (feedbackCount === 0) {
    const managerIds = db.prepare(`SELECT id FROM managers`).all() as any[];
    const collabIds = db.prepare(`SELECT id FROM collaborators`).all() as any[];
    const statuses = ["aceito", "sem_aceite", "pendente"];
    const types = ["Orientativo", "Reconhecimento", "Avaliativo"];
    const insertFb = db.prepare(
      `INSERT INTO feedbacks (manager_id, collaborator_id, feedback_date, type, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - randInt(0, 89));
      const manager = managerIds[randInt(0, managerIds.length - 1)];
      const collab = collabIds[randInt(0, collabIds.length - 1)];
      insertFb.run(
        manager.id,
        collab.id,
        dateStr(d),
        types[randInt(0, types.length - 1)],
        statuses[randInt(0, statuses.length - 1)],
        "Feedback de demonstração gerado automaticamente.",
        adminId
      );
    }
  }

  const assetsCount = (db.prepare(`SELECT COUNT(*) as c FROM assets`).get() as any).c;
  if (assetsCount === 0) {
    const insertAsset = db.prepare(
      `INSERT INTO assets (patrimony_number, name, category, location, responsible, acquisition_date, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const categories = ["Mobiliário", "Eletrônico", "Equipamento Médico", "Informática"];
    const statuses = ["bom_estado", "quebrado", "chamado_aberto", "resolvido", "em_manutencao", "baixado"];
    const items = [
      "Cadeira de rodas", "Maca hospitalar", "Computador", "Monitor", "Impressora",
      "Cadeira ergonômica", "Armário de aço", "Telefone IP", "Ar condicionado", "Bebedouro",
    ];
    items.forEach((item, i) => {
      insertAsset.run(
        `PAT-${5000 + i}`,
        item,
        categories[i % categories.length],
        UNITS[i % UNITS.length],
        "Setor SUAC",
        dateStr(new Date(2022, i % 12, 5)),
        statuses[i % statuses.length],
        "Item de demonstração.",
        adminId
      );
    });
  }

  console.log("Seed de demonstração concluído.");
}

seed();
