import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getRouteMeta } from '../../data/navigation';
import { appConfig } from '../../config/app';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

// AppShell owns layout state while child pages stay focused on their route content.
export function AppShell() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const route = getRouteMeta(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="app-main">
        <AppHeader route={route} onOpenMenu={() => setSidebarOpen(true)} />
        <main className="page-content">
          <Suspense
            fallback={
              <div className="loading-state" role="status">
                Cargando página…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>{route.label}</span>
          <span>{appConfig.shortName} · Plataforma veterinaria</span>
        </footer>
      </div>
    </div>
  );
}
