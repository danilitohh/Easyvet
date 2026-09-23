import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../contexts/useAuth';

// AuthBoundary protects every application route while preserving the requested URL for future login UX.
export function AuthBoundary() {
  const location = useLocation();
  const { status, organizationSelectionRequired, user } = useAuth();

  if (status === 'loading') return <LoadingState label="Restaurando sesión…" />;
  if (status === 'unauthenticated') {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  }
  if (user?.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate replace to="/cambiar-contrasena" />;
  }
  if (
    organizationSelectionRequired &&
    !user?.mustChangePassword &&
    location.pathname !== '/seleccionar-organizacion'
  ) {
    return <Navigate replace to="/seleccionar-organizacion" />;
  }
  return <Outlet />;
}
