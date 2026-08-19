import { useState } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext";
import { Tabs } from "../../components/ui/Tabs";
import SerecPatients from "./SerecPatients";
import SerecEntries from "./SerecEntries";
import SerecServiceTimes from "./SerecServiceTimes";
import SerecErrors from "./SerecErrors";

export default function SerecPage() {
  const [tab, setTab] = useState("atendimentos");
  usePageHeader({ title: "SEREC · Indicadores" });

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: "atendimentos", label: "Atendimentos" },
          { key: "entradas", label: "Entradas" },
          { key: "tempos", label: "Tempo de Atendimento" },
          { key: "erros", label: "Erros Operacionais" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "atendimentos" && <SerecPatients />}
      {tab === "entradas" && <SerecEntries />}
      {tab === "tempos" && <SerecServiceTimes />}
      {tab === "erros" && <SerecErrors />}
    </div>
  );
}
