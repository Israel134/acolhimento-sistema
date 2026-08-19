import { usePageHeader } from "../contexts/PageHeaderContext";
import { SuacAssets } from "./suac/SuacAssets";

export default function Patrimonios() {
  usePageHeader({ title: "Patrimônios" });
  return <SuacAssets />;
}
