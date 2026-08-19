import { useState } from "react";
import { Sun, Moon, Monitor, Trash2 } from "lucide-react";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { api, apiErrorMessage } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/Modal";

export default function Configuracoes() {
  usePageHeader({ title: "Configurações" });
  const { theme, setTheme } = useTheme();
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const options: { value: "light" | "dark" | "system"; label: string; icon: any }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Automático (sistema)", icon: Monitor },
  ];

  const handleClearDemo = async () => {
    setClearing(true);
    try {
      await api.post("/demo/clear");
      notify("Dados de demonstração removidos com sucesso.");
      setConfirmClear(false);
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Card title="Aparência" subtitle="A preferência é salva neste dispositivo">
        <div className="grid sm:grid-cols-3 gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                theme === opt.value
                  ? "border-[var(--brand-1)] bg-[var(--brand-1)]/10 text-[var(--brand-1)]"
                  : "border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
              }`}
            >
              <opt.icon size={20} />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Atualização automática">
        <p className="text-sm text-[var(--text-secondary)]">
          Os dashboards e indicadores são atualizados automaticamente a cada 30 segundos. Use o botão
          <strong> "Atualizar agora" </strong> no topo de cada página para forçar uma atualização imediata.
        </p>
      </Card>

      {hasRole("administrador") && (
        <Card title="Dados de demonstração" className="border-[var(--status-warning)]/30">
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Remove todos os dados fictícios gerados para demonstração (pacientes, feedbacks, patrimônios,
            colaboradores e gestores). Usuários e histórico de auditoria são preservados. Esta ação não pode ser desfeita.
          </p>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 size={15} /> Limpar dados de demonstração
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearDemo}
        loading={clearing}
        title="Limpar dados de demonstração"
        message="Tem certeza que deseja remover todos os dados fictícios de demonstração? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
