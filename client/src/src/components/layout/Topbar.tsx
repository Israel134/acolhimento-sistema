import { useState } from "react";
import { Menu, Sun, Moon, Monitor, Bell, LogOut, User as UserIcon, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Link } from "react-router-dom";

export function Topbar({
  onOpenMobile,
  title,
  lastUpdated,
  onRefresh,
  refreshing,
}: {
  onOpenMobile: () => void;
  title: string;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 card-surface border-b border-[var(--border-hairline)] flex items-center gap-3 px-4 sm:px-6">
      <button onClick={onOpenMobile} className="lg:hidden p-1.5 -ml-1.5 text-[var(--text-secondary)]" aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <h1 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] truncate">{title}</h1>

      {lastUpdated && (
        <div className="hidden sm:flex items-center gap-2 ml-3 text-xs text-[var(--text-muted)]">
          <span>
            Última atualização: {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Atualizar agora</span>
          </button>
        )}

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          title={`Tema: ${theme === "system" ? "Automático" : theme === "dark" ? "Escuro" : "Claro"}`}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
        >
          {theme === "system" ? <Monitor size={17} /> : resolvedTheme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        <button className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-1)]">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-[var(--brand-1)]/15 text-[var(--brand-1)] flex items-center justify-center text-xs font-semibold overflow-hidden"
          >
            {user?.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" /> : user?.name?.slice(0, 2).toUpperCase()}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-48 card-surface rounded-lg shadow-xl border border-[var(--border-hairline)] py-1 z-20">
                <div className="px-3 py-2 border-b border-[var(--border-hairline)]">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user?.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{user?.email}</p>
                </div>
                <Link
                  to="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                >
                  <UserIcon size={14} /> Meu Perfil
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--status-critical)] hover:bg-[var(--status-critical)]/10"
                >
                  <LogOut size={14} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
