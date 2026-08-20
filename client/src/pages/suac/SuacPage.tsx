import { useState } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { Tabs } from "../../components/ui/Tabs";
import { SuacFeedbacks } from "./SuacFeedbacks";
import { SuacAssets } from "./SuacAssets";
import { SuacMeetings } from "./SuacMeetings";
import { SuacOmbudsman } from "./SuacOmbudsman";
import { SuacOvertime } from "./SuacOvertime";

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
          { key: "horas", label: "Horas Extras" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "feedbacks" && <SuacFeedbacks />}
      {tab === "patrimonios" && <SuacAssets />}
      {tab === "treinamentos" && <SuacMeetings />}
      {tab === "ouvidorias" && <SuacOmbudsman />}
      {tab === "horas" && <SuacOvertime />}
    </div>
  );
}
