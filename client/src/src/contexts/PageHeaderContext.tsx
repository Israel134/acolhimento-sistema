import React, { createContext, useContext, useState, useCallback } from "react";

interface PageHeaderState {
  title: string;
  lastUpdated: Date | null;
  onRefresh: (() => void) | null;
  refreshing: boolean;
}

interface PageHeaderContextValue extends PageHeaderState {
  setHeader: (s: Partial<PageHeaderState>) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PageHeaderState>({
    title: "Dashboard",
    lastUpdated: null,
    onRefresh: null,
    refreshing: false,
  });

  const setHeader = useCallback((s: Partial<PageHeaderState>) => {
    setState((prev) => {
      const next = { ...prev, ...s };
      const unchanged =
        next.title === prev.title &&
        next.lastUpdated?.getTime() === prev.lastUpdated?.getTime() &&
        next.onRefresh === prev.onRefresh &&
        next.refreshing === prev.refreshing;
      return unchanged ? prev : next;
    });
  }, []);

  return <PageHeaderContext.Provider value={{ ...state, setHeader }}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderContext() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderContext deve ser usado dentro de PageHeaderProvider");
  return ctx;
}

/** Hook usado pelas páginas para definir título / estado de atualização do Topbar. */
export function usePageHeader(state: Partial<PageHeaderState>) {
  const { setHeader } = usePageHeaderContext();
  const { title, lastUpdated, onRefresh, refreshing } = state;
  React.useEffect(() => {
    setHeader({ title, lastUpdated, onRefresh: onRefresh || null, refreshing: !!refreshing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, lastUpdated, onRefresh, refreshing]);
}
