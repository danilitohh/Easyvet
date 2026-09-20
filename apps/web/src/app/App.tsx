import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { MODULE_ROUTES } from '../data/navigation';
import { DashboardPage } from '../pages/DashboardPage';
import { HealthPage } from '../pages/HealthPage';
import { ModulePage } from '../pages/ModulePage';
import { NotFoundPage } from '../pages/NotFoundPage';

// Route declarations keep every product area addressable without hiding sections in the DOM.
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="health" element={<HealthPage />} />
        {MODULE_ROUTES.filter((route) => route.path !== '/dashboard').map((route) => (
          <Route
            key={route.path}
            path={route.path.slice(1)}
            element={<ModulePage route={route} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
