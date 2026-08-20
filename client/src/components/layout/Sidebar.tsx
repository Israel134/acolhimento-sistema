import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  Building2,
  Ambulance,
  Boxes,
  Package,
  FileBarChart,
  ShieldCheck,
  Settings,
  ListChecks,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  X,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles?: string[];
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  { items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Indicadores",
    items: [
      { to: "/serec", label: "SEREC", icon: ClipboardList },
      { to: "/suac", label: "SUAC", icon: Building2 },
      { to: "/setip", label: "SETIP", icon: Ambulance },
      { to: "/seppert", label: "SEPPERT", icon: Boxes },
    ],
  },
  {
    title: "Gestão",
    items: [
      { to: "/tarefas", label: "Tarefas", icon: ListChecks, roles: ["administrador", "gestor"] },
      { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["administrador", "gestor"] },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { to: "/colaboradores", label: "Colaboradores", icon: Users },
      { to: "/gestores", label: "Gestores", icon: UserCog },
      { to: "/patrimonios", label: "Patrimônios", icon: Package },
      { to: "/usuarios", label: "Usuários", icon: ShieldCheck, roles: ["administrador"] },
    ],
  },
  {
    items: [
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
      { to: "/auditoria", label: "Auditoria", icon: ShieldCheck, roles: ["administrador"] },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { user, hasRole } = useAuth();

  const content = (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2 px-4 h-16 shrink-0 border-b border-[var(--border-hairline)] ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-1)] flex items-center justify-center text-white shrink-0">
          <HeartPulse size={18} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">Acolhimento</p>
            <p className="text-[11px] text-[var(--text-muted)] leading-tight truncate">Gestão Hospitalar</p>
          </div>
        )}
        <button onClick={onCloseMobile} className="ml-auto lg:hidden p-1.5 text-[var(--text-muted)]" aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {GROUPS.map((group, gi) => {
          const items = group.items.filter((it) => !it.roles || hasRole(...it.roles));
          if (items.length === 0) return null;
          return (
            <div key={gi} className="mb-3">
              {group.title && !collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        collapsed ? "justify-center px-0 mx-auto w-10" : ""
                      } ${
                        isActive
                          ? "bg-[var(--brand-1)]/12 text-[var(--brand-1)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
                      }`
                    }
                  >
                    <item.icon size={18} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={`border-t border-[var(--border-hairline)] p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="w-8 h-8 rounded-full bg-[var(--brand-1)]/15 text-[var(--brand-1)] flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
              {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" /> : user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user.name}</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center gap-2 w-full rounded-lg py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
        >
          {collapsed ? <ChevronsRight size={16} /> : (<><ChevronsLeft size={16} /> Recolher</>)}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 card-surface border-r border-[var(--border-hairline)] transition-[width] duration-200 ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {content}
      </aside>

      {/* Mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 h-full w-72 card-surface shadow-2xl animate-[slideIn_0.2s_ease]">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
