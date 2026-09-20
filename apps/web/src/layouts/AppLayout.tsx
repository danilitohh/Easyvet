import { NavLink, Outlet } from 'react-router-dom';
import { appConfig } from '../config/app';

// The shell provides only navigation needed to prove route boundaries in the scaffold.
export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Technical foundation</p>
          <h1>{appConfig.appName}</h1>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/">
            Home
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            to="/health"
          >
            Health
          </NavLink>
        </nav>
      </header>
      <main className="page-content">
        <Outlet />
      </main>
      <footer className="app-footer">Phase 1 · infrastructure only</footer>
    </div>
  );
}
