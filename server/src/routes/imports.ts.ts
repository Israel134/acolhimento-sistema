import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { runImport, templateCsv, ImportConfig } from "../utils/importer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Mapas de valores amigáveis -> canônicos
const SECTOR = { serec: "SEREC", suac: "SUAC", setip: "SETIP", seppert: "SEPPERT", geral: "GERAL" };
const STATUS_ATIVO = { ativo: "ativo", inativo: "inativo", ativa: "ativo", inativa: "inativo", a: "ativo", i: "inativo", "1": "ativo", "0": "inativo" };
const SECTORS_LIST = ["SEREC", "SUAC", "SETIP", "SEPPERT", "GERAL"];
const ASSET_STATUS = {
  "bom estado": "bom_estado", bom: "bom_estado", "em uso": "bom_estado",
  quebrado: "quebrado", "chamado aberto": "chamado_aberto", resolvido: "resolvido",
  "em manutencao": "em_manutencao", manutencao: "em_manutencao", baixado: "baixado",
};
const SEREC_CAT = { urgencia: "urgencia", ambulatorio: "ambulatorio", internados: "internados", internado: "internados" };
const ENTRY_TYPE = { acompanhante: "acompanhante", visitante: "visitante", colaborador: "colaborador" };
const SHIFT = { manha: "manha", tarde: "tarde", noite: "noite" };
const ERROR_TYPE = { cadastro: "cadastro", documentacao: "documentacao", triagem: "triagem", comunicacao: "comunicacao", sistema: "sistema", outro: "outro" };
const SEVERITY = { leve: "leve", moderado: "moderado", grave: "grave" };
const FB_STATUS = { aceito: "aceito", "sem aceite": "sem_aceite", pendente: "pendente" };
const OMB_TYPE = { ouvidoria: "ouvidoria", notificacao: "notificacao" };
const OMB_STATUS = { pendente: "pendente", respondida: "respondida", encerrada: "encerrada" };
const TRANSPORT = { maca: "maca", "cadeira de rodas": "cadeira_rodas", cadeira: "cadeira_rodas", leito: "leito", "a pe": "a_pe", outro: "outro" };
const TASK_PRIORITY = { urgente: "urgente", alta: "alta", moderada: "moderada", baixa: "baixa" };
const TASK_STATUS = { pendente: "pendente", "em andamento": "em_andamento", concluida: "concluida" };
const MEETING_KIND = { reuniao: "reuniao", treinamento: "treinamento" };

const WRITE = ["administrador", "gestor"];

const REGISTRY: Record<string, ImportConfig & { title: string }> = {
  collaborators: {
    title: "Colaboradores",
    table: "collaborators", module: "colaboradores", writeRoles: ["administrador", "gestor"],
    uniqueBy: ["registration"],
    promptFields: [{ field: "sector", label: "Setor (use caso a planilha não tenha a coluna Setor)", options: SECTORS_LIST }],
    columns: [
      { field: "name", labels: ["Nome", "name"], required: true },
      { field: "rh", labels: ["RH", "rh"] },
      { field: "registration", labels: ["Matrícula", "Matricula", "Chapa", "registration"] },
      { field: "position", labels: ["Cargo", "Nome Funcão", "Nome Funcao", "Função", "Funcao", "Função do colaborador", "position"] },
      { field: "sector", labels: ["Setor", "sector"], required: true, enumMap: SECTOR },
      { field: "admission_date", labels: ["Data de admissão", "Data de Admissão", "Admissão", "Admissao", "admission_date"], type: "date" },
      { field: "status", labels: ["Status", "Situação", "Situacao"], enumMap: STATUS_ATIVO, default: "ativo" },
    ],
  },
  managers: {
    title: "Gestores",
    table: "managers", module: "gestores", writeRoles: ["administrador"],
    promptFields: [{ field: "sector", label: "Setor (use caso a planilha não tenha a coluna Setor)", options: SECTORS_LIST }],
    columns: [
      { field: "name", labels: ["Nome", "name"], required: true },
      { field: "rh", labels: ["RH", "rh"] },
      { field: "registration", labels: ["Matrícula", "Matricula", "Chapa", "registration"] },
      { field: "position", labels: ["Cargo", "Nome Funcão", "Nome Funcao", "Função", "Funcao", "position"] },
      { field: "sector", labels: ["Setor", "sector"], required: true, enumMap: SECTOR },
      { field: "shift_type", labels: ["Tipo", "Turno", "shift_type"] },
      { field: "status", labels: ["Status", "Situação", "Situacao"], enumMap: STATUS_ATIVO, default: "ativo" },
    ],
  },
  assets: {
    title: "Patrimônios",
    table: "assets", module: "patrimonios", writeRoles: ["administrador", "gestor"],
    uniqueBy: ["patrimony_number"],
    columns: [
      { field: "patrimony_number", labels: ["Número do patrimônio", "Numero do patrimonio", "Nº Patrimônio", "Nº PATRIMONIO", "N Patrimonio", "Patrimônio", "Patrimonio", "patrimony_number"] },
      { field: "name", labels: ["Nome do item", "ITEM", "Item", "Nome", "name"], required: true },
      { field: "category", labels: ["Categoria", "category"] },
      { field: "location", labels: ["Localização", "Localizacao", "LOCAL", "Local", "location"] },
      { field: "responsible", labels: ["Responsável", "Responsavel", "responsible"] },
      { field: "acquisition_date", labels: ["Data de aquisição", "Aquisição", "Aquisicao", "acquisition_date"], type: "date" },
      { field: "status", labels: ["Estado", "ESTADO", "Status", "Situação", "Situacao"], enumMap: ASSET_STATUS, default: "bom_estado" },
      { field: "description", labels: ["Descrição", "Descricao", "Observação", "Observacao", "description"] },
    ],
  },
  serec_patients: {
    title: "SEREC · Atendimentos",
    table: "serec_patients", module: "serec_pacientes", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "unit", labels: ["Unidade", "unit"], required: true },
      { field: "category", labels: ["Tipo", "Categoria", "category"], required: true, enumMap: SEREC_CAT },
      { field: "quantity", labels: ["Quantidade", "quantity"], required: true, type: "int" },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
  },
  serec_entries: {
    title: "SEREC · Entradas",
    table: "serec_entries", module: "serec_entradas", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "unit", labels: ["Unidade", "unit"], required: true },
      { field: "entry_type", labels: ["Tipo", "entry_type"], required: true, enumMap: ENTRY_TYPE },
      { field: "quantity", labels: ["Quantidade", "quantity"], required: true, type: "int" },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
  },
  serec_service_times: {
    title: "SEREC · Tempo de Atendimento",
    table: "serec_service_times", module: "serec_tempo_atendimento", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "unit", labels: ["Unidade", "unit"], required: true },
      { field: "shift", labels: ["Turno", "shift"], enumMap: SHIFT },
      { field: "avg_wait_minutes", labels: ["Tempo médio de espera", "Espera", "avg_wait_minutes"], required: true, type: "number" },
      { field: "avg_service_minutes", labels: ["Tempo médio de atendimento", "Atendimento", "avg_service_minutes"], required: true, type: "number" },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
  },
  serec_operational_errors: {
    title: "SEREC · Erros Operacionais",
    table: "serec_operational_errors", module: "serec_erros_operacionais", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "unit", labels: ["Unidade", "unit"], required: true },
      { field: "error_type", labels: ["Tipo", "Tipo de erro", "error_type"], required: true, enumMap: ERROR_TYPE },
      { field: "severity", labels: ["Gravidade", "severity"], enumMap: SEVERITY, default: "leve" },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
    ],
    lookups: [{ field: "collaborator_id", labels: ["Colaborador", "collaborator"], table: "collaborators" }],
  },
  setip_transports: {
    title: "SETIP · Transporte de Pacientes",
    table: "setip_transports", module: "setip_transporte", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "unit", labels: ["Unidade", "unit"], required: true },
      { field: "quantity", labels: ["Quantidade", "quantity"], required: true, type: "int" },
      { field: "transport_type", labels: ["Tipo", "Tipo de transporte", "transport_type"], enumMap: TRANSPORT },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
    lookups: [{ field: "collaborator_id", labels: ["Colaborador", "collaborator"], table: "collaborators" }],
  },
  feedbacks: {
    title: "SUAC · Feedbacks",
    table: "feedbacks", module: "feedbacks", writeRoles: WRITE,
    columns: [
      { field: "feedback_date", labels: ["Data", "feedback_date"], required: true, type: "date" },
      { field: "type", labels: ["Tipo", "type"] },
      { field: "status", labels: ["Status"], enumMap: FB_STATUS, default: "pendente" },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
    ],
    lookups: [
      { field: "manager_id", labels: ["Gestor", "manager"], table: "managers" },
      { field: "collaborator_id", labels: ["Colaborador", "collaborator"], table: "collaborators" },
    ],
  },
  ombudsman: {
    title: "SUAC · Ouvidorias e Notificações",
    table: "ombudsman", module: "ouvidorias", writeRoles: WRITE,
    columns: [
      { field: "record_type", labels: ["Tipo", "record_type"], required: true, enumMap: OMB_TYPE },
      { field: "number", labels: ["Número", "Numero", "number"] },
      { field: "occurrence_date", labels: ["Data da ocorrência", "Ocorrência", "Ocorrencia", "occurrence_date"], required: true, type: "date" },
      { field: "response_date", labels: ["Data da resposta", "Resposta", "response_date"], type: "date" },
      { field: "sector", labels: ["Setor", "sector"], enumMap: SECTOR },
      { field: "status", labels: ["Status"], enumMap: OMB_STATUS, default: "pendente" },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
    ],
    lookups: [{ field: "manager_id", labels: ["Gestor", "manager"], table: "managers" }],
  },
  overtime: {
    title: "SUAC · Horas Extras",
    table: "overtime", module: "horas_extras", writeRoles: WRITE,
    columns: [
      { field: "record_date", labels: ["Data", "record_date"], required: true, type: "date" },
      { field: "sector", labels: ["Setor", "sector"], required: true, enumMap: SECTOR },
      { field: "unit", labels: ["Unidade", "unit"] },
      { field: "hours", labels: ["Horas", "Quantidade de horas", "hours"], required: true, type: "number" },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
    lookups: [{ field: "manager_id", labels: ["Gestor", "manager"], table: "managers" }],
  },
  meetings: {
    title: "SUAC · Treinamentos e Reuniões",
    table: "meetings", module: "reunioes", writeRoles: WRITE,
    columns: [
      { field: "kind", labels: ["Tipo", "kind"], enumMap: MEETING_KIND, default: "reuniao" },
      { field: "title", labels: ["Assunto", "Título", "Titulo", "title"], required: true },
      { field: "meeting_date", labels: ["Data", "meeting_date"], required: true, type: "date" },
      { field: "meeting_time", labels: ["Hora", "meeting_time"] },
      { field: "location", labels: ["Local", "location"] },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
    ],
    lookups: [{ field: "manager_id", labels: ["Gestor", "manager"], table: "managers" }],
  },
  agenda_events: {
    title: "Agenda",
    table: "agenda_events", module: "agenda", writeRoles: WRITE,
    columns: [
      { field: "title", labels: ["Título", "Titulo", "title"], required: true },
      { field: "event_date", labels: ["Data", "event_date"], required: true, type: "date" },
      { field: "start_time", labels: ["Hora inicial", "Início", "Inicio", "start_time"] },
      { field: "end_time", labels: ["Hora final", "Fim", "end_time"] },
      { field: "location", labels: ["Local", "location"] },
      { field: "participants", labels: ["Participantes", "participants"] },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
    ],
  },
  tasks: {
    title: "Tarefas",
    table: "tasks", module: "tarefas", writeRoles: ["administrador"],
    columns: [
      { field: "title", labels: ["Título", "Titulo", "title"], required: true },
      { field: "description", labels: ["Descrição", "Descricao", "description"] },
      { field: "priority", labels: ["Prioridade", "priority"], enumMap: TASK_PRIORITY, default: "moderada" },
      { field: "due_date", labels: ["Prazo", "due_date"], type: "date" },
      { field: "status", labels: ["Status"], enumMap: TASK_STATUS, default: "pendente" },
      { field: "observation", labels: ["Observação", "Observacao", "observation"] },
    ],
    lookups: [{ field: "assigned_to", labels: ["Responsável", "Responsavel", "assigned_to"], table: "users" }],
  },
};

const router = Router();

router.get("/:resource/info", requireAuth, (req, res) => {
  const cfg = REGISTRY[req.params.resource];
  if (!cfg) return res.status(404).json({ error: "Recurso de importação não encontrado." });
  res.json({
    title: cfg.title,
    columns: cfg.columns.map((c) => c.labels[0]),
    lookups: (cfg.lookups || []).map((l) => l.labels[0]),
    promptFields: cfg.promptFields || [],
  });
});

router.get("/:resource/template", requireAuth, (req, res) => {
  const cfg = REGISTRY[req.params.resource];
  if (!cfg) return res.status(404).json({ error: "Recurso de importação não encontrado." });
  const csv = templateCsv(cfg);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="modelo_${req.params.resource}.csv"`);
  res.send(csv);
});

router.post("/:resource", requireAuth, upload.single("file"), (req, res) => {
  const cfg = REGISTRY[req.params.resource];
  if (!cfg) return res.status(404).json({ error: "Recurso de importação não encontrado." });
  const roles = cfg.writeRoles || WRITE;
  if (!roles.includes(req.user!.role)) {
    return res.status(403).json({ error: "Permissão insuficiente para importar neste módulo." });
  }
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
  try {
    // valores informados manualmente na tela (ex: setor quando a planilha não tem a coluna)
    const overrides: Record<string, any> = {};
    for (const pf of cfg.promptFields || []) {
      if (req.body && req.body[pf.field] !== undefined && req.body[pf.field] !== "") {
        overrides[pf.field] = req.body[pf.field];
      }
    }
    const result = runImport(cfg, req.file.buffer, req.user!.id, overrides);
    res.json(result);
  } catch (err: any) {
    console.error("[imports] Falha ao importar:", err);
    res.status(400).json({ error: "Não foi possível ler a planilha. Verifique se é um arquivo .xlsx ou .csv válido.", details: err?.message });
  }
});

export default router;
