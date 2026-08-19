import React from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`card-surface rounded-xl p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
            {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "var(--brand-1)",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: string;
}) {
  return (
    <div className="card-surface rounded-xl p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text-secondary)] truncate">{label}</p>
        <p className="text-2xl font-semibold text-[var(--text-primary)] mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-xs text-[var(--text-muted)] mt-1">{hint}</p>}
      </div>
      {Icon && (
        <div
          className="shrink-0 rounded-lg p-2"
          style={{ backgroundColor: `color-mix(in oklab, ${accent} 15%, transparent)`, color: accent }}
        >
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}
