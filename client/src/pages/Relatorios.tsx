import { useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { api } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Select } from "../components/ui/Form";
import { PeriodFilter, defaultPeriod } from "../components/ui/PeriodFilter";
import type { Period } from "../components/ui/PeriodFilter";
import { exportCsv, formatDate, label as labelFor } from "../lib/format";
import { useToast } from "../contexts/ToastContext";

const INDICATORS = [
  { value: "serec_patients", label: "SEREC · Atendimentos", endpoint: "/serec/patients", dateField: "record_date" },
  { value: "serec_entries", label: "SEREC · Entradas", endpoint: "/serec/entries", dateField: "record_date" },
  { value: "serec_service_times", label: "SEREC · Tempo de Atendimento", endpoint: "/serec/service-times", dateField: "record_date" },
  { value: "serec_errors", label: "SEREC · Erros Operacionais", endpoint: "/serec/errors", dateField: "record_date" },
  { value: "feedbacks", label: "SUAC · Feedbacks", endpoint: "/suac/feedbacks", dateField: "feedback_date" },
  { value: "assets", label: "SUAC · Patrimônios (sem filtro de data)", endpoint: "/assets", dateField: null },
];

export default function Relatorios() {
  usePageHeader({ title: "Relatórios" });
  const { notify } = useToast();
  const [indicator, setIndicator] = useState(INDICATORS[0].value);
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const selected = INDICATORS.find((i) => i.value === indicator)!;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.get(selected.endpoint, { params: { pageSize: 1000, sort: selected.dateField || "id", order: "desc" } });
      let data: any[] = res.data.data;
      if (selected.dateField) {
        data = data.filter((r) => r[selected.dateField!] >= period.from && r[selected.dateField!] <= period.to);
      }
      setRows(data);
      setLoaded(true);
    } catch {
      notify("Não foi possível gerar o relatório.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    exportCsv(`${indicator}_${period.from}_a_${period.to}.csv`, rows);
    notify("Relatório exportado com sucesso.");
  };

  return (
    <div className="space-y-5">
      <Card title="Gerar relatório">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Field label="Indicador">
            <Select value={indicator} onChange={(e) => { setIndicator(e.target.value); setLoaded(false); }}>
              {INDICATORS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </Select>
          </Field>
          <div className="flex items-end">
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={loading}>
            <FileBarChart size={15} /> {loading ? "Gerando..." : "Gerar relatório"}
          </Button>
          {loaded && (
            <Button variant="secondary" onClick={handleExport}>
              <Download size={15} /> Exportar CSV
            </Button>
          )}
        </div>
      </Card>

      {loaded && (
        <Card title={`Resultado — ${rows.length} registro(s)`} subtitle={selected.dateField ? `Período: ${formatDate(period.from)} até ${formatDate(period.to)}` : "Sem filtro de período"}>
          <div className="overflow-x-auto scrollbar-thin -m-4 sm:-m-5">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-left">
                  {rows[0] && Object.keys(rows[0]).map((k) => (
                    <th key={k} className="px-4 py-2 font-semibold text-[var(--text-secondary)] whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border-hairline)] last:border-0">
                    {Object.entries(r).map(([k, v]) => (
                      <td key={k} className="px-4 py-2 whitespace-nowrap text-[var(--text-primary)]">
                        {typeof v === "string" && /status|category/.test(k) ? labelFor(v) : String(v ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="px-4 py-2 text-[11px] text-[var(--text-muted)]">
                Exibindo os 50 primeiros registros. Exporte para CSV para ver o relatório completo.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
