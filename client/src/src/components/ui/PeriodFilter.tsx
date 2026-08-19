import { daysAgoStr, firstDayOfMonthStr, firstDayOfYearStr, lastDayOfMonthStr, startOfWeekStr, todayStr } from "../../lib/format";
import { Input } from "./Form";
import { Calendar } from "lucide-react";

export interface Period {
  from: string;
  to: string;
  presetLabel: string;
}

const PRESETS: { label: string; get: () => Period }[] = [
  { label: "Hoje", get: () => ({ from: todayStr(), to: todayStr(), presetLabel: "Hoje" }) },
  {
    label: "Ontem",
    get: () => ({ from: daysAgoStr(1), to: daysAgoStr(1), presetLabel: "Ontem" }),
  },
  { label: "Esta semana", get: () => ({ from: startOfWeekStr(), to: todayStr(), presetLabel: "Esta semana" }) },
  { label: "Últimos 7 dias", get: () => ({ from: daysAgoStr(6), to: todayStr(), presetLabel: "Últimos 7 dias" }) },
  { label: "Últimos 30 dias", get: () => ({ from: daysAgoStr(29), to: todayStr(), presetLabel: "Últimos 30 dias" }) },
  { label: "Este mês", get: () => ({ from: firstDayOfMonthStr(), to: lastDayOfMonthStr(), presetLabel: "Este mês" }) },
  {
    label: "Mês anterior",
    get: () => ({ from: firstDayOfMonthStr(-1), to: lastDayOfMonthStr(-1), presetLabel: "Mês anterior" }),
  },
  { label: "Este ano", get: () => ({ from: firstDayOfYearStr(), to: todayStr(), presetLabel: "Este ano" }) },
];

export function defaultPeriod(): Period {
  return (PRESETS.find((p) => p.label === "Últimos 30 dias") || PRESETS[0]).get();
}

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs mr-1">
        <Calendar size={14} /> Período:
      </div>
      <select
        value={value.presetLabel}
        onChange={(e) => {
          const preset = PRESETS.find((p) => p.label === e.target.value);
          if (preset) onChange(preset.get());
          else onChange({ ...value, presetLabel: "Personalizado" });
        }}
        className="text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-1.5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-1)]/40"
      >
        {PRESETS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.label}
          </option>
        ))}
        <option value="Personalizado">Período personalizado</option>
      </select>
      <Input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value, presetLabel: "Personalizado" })}
        className="!w-auto text-xs py-1.5"
      />
      <span className="text-[var(--text-muted)] text-xs">até</span>
      <Input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value, presetLabel: "Personalizado" })}
        className="!w-auto text-xs py-1.5"
      />
    </div>
  );
}
