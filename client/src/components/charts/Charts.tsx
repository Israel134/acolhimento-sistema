import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatDate, label as labelFor } from "../../lib/format";

export const CATEGORICAL = [
  "var(--brand-1)",
  "var(--brand-2)",
  "var(--brand-3)",
  "var(--brand-4)",
  "var(--brand-5)",
  "var(--brand-6)",
  "var(--brand-7)",
  "var(--brand-8)",
];

const tooltipStyle = {
  backgroundColor: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

export function EmptyChart({ message = "Sem dados para o período selecionado." }: { message?: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center text-sm text-[var(--text-muted)]">{message}</div>
  );
}

export function AppLineChart({
  data,
  dataKey = "total",
  xKey = "date",
  color = CATEGORICAL[0],
  formatX = formatDate,
  height = 260,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  formatX?: (v: string) => string;
  height?: number;
}) {
  if (!data?.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid-hairline)" />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatX}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={{ stroke: "var(--grid-hairline)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => formatX(String(v))}
          formatter={(v: any) => [v, "Total"]}
        />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AppBarChart({
  data,
  dataKey = "total",
  xKey = "category",
  formatXLabel = labelFor,
  height = 260,
  colorByIndex = true,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  formatXLabel?: (v: string) => string;
  height?: number;
  colorByIndex?: boolean;
}) {
  if (!data?.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid-hairline)" />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatXLabel}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={{ stroke: "var(--grid-hairline)" }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatXLabel(String(v))} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colorByIndex ? CATEGORICAL[i % CATEGORICAL.length] : CATEGORICAL[0]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AppPieChart({
  data,
  dataKey = "c",
  nameKey = "status",
  formatName = labelFor,
  height = 260,
  donut = true,
}: {
  data: any[];
  dataKey?: string;
  nameKey?: string;
  formatName?: (v: string) => string;
  height?: number;
  donut?: boolean;
}) {
  if (!data?.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [v, formatName(String(n))]} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          formatter={(v) => formatName(String(v))}
        />
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={donut ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--surface-card)"
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
