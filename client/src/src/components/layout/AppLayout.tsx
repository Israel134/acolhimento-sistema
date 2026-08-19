import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PageHeaderProvider, usePageHeaderContext } from "../../contexts/PageHeaderContext";

function LayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { title, lastUpdated, onRefresh, refreshing } = usePageHeaderContext();

  return (
    <div className="flex min-h-screen bg-[var(--surface-page)]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onOpenMobile={() => setMobileOpen(true)}
          title={title}
          lastUpdated={lastUpdated}
          onRefresh={onRefresh || undefined}
          refreshing={refreshing}
        />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <PageHeaderProvider>
      <LayoutInner />
    </PageHeaderProvider>
  );
}
