import { useState } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { Tabs, EmptyState } from "../../components/ui/Tabs";
import { SuacFeedbacks } from "./SuacFeedbacks";
import { SuacAssets } from "./SuacAssets";

export default function SuacPage() {
  const [tab, setTab] = useState("feedbacks");
  usePageHeader({ title: "SUAC · Indicadores" });

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: "feedbacks", label: "Feedbacks" },
          { key: "patrimonios", label: "Patrimônios" },
          { key: "treinamentos", label: "Treinamentos e Reuniões" },
          { key: "ouvidorias", label: "Ouvidorias e Notificações" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "feedbacks" && <SuacFeedbacks />}
      {tab === "patrimonios" && <SuacAssets />}
      {tab === "treinamentos" && (
        <EmptyState
          title="Módulo em construção"
          message="O indicador de Treinamentos e Reuniões faz parte da próxima etapa de expansão do sistema."
        />
      )}
      {tab === "ouvidorias" && (
        <EmptyState
          title="Módulo em construção"
          message="O indicador de Ouvidorias e Notificações faz parte da próxima etapa de expansão do sistema."
        />
      )}
    </div>
  );
}
