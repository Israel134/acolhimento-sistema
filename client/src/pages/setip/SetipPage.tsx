import { usePageHeader } from "../../contexts/PageHeaderContext";
import SetipTransports from "./SetipTransports";

export default function SetipPage() {
  usePageHeader({ title: "SETIP · Indicadores" });
  return (
    <div className="space-y-4">
      <SetipTransports />
    </div>
  );
}
