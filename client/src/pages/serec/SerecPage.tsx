import { useState } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { Tabs, EmptyState } from "../../components/ui/Tabs";
import SerecPatients from "./SerecPatients";

export default function SerecPage() {
  const [tab, setTab] = useState("pacientes");
  usePageHeader({ title: "SEREC · Indicadores" });

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: "pacientes", label: "Pacientes Atendidos" },
          { key: "entradas", label: "Entradas" },
          { key: "tempos", label: "Tempo de Atendimento" },
          { key: "erros", label: "Erros Operacionais" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "pacientes" && <SerecPatients />}
      {tab === "entradas" && (
        <EmptyState title="Módulo em construção" message="O indicador de Entradas (acompanhantes, visitantes e colaboradores) faz parte da próxima etapa de expansão." />
      )}
      {tab === "tempos" && (
        <EmptyState title="Módulo em construção" message="O indicador de Tempo de Atendimento da recepção faz parte da próxima etapa de expansão." />
      )}
      {tab === "erros" && (
        <EmptyState title="Módulo em construção" message="O indicador de Erros Operacionais faz parte da próxima etapa de expansão." />
      )}
    </div>
  );
}
