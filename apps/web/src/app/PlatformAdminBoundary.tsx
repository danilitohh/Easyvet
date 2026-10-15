import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { LoadingState } from '../components/ui/LoadingState';

export function PlatformAdminBoundary() {
  const { status, user } = useAuth();

  if (status === 'loading') return <LoadingState label="Verificando acceso de plataforma…" />;
  if (status === 'unauthenticated') return <Navigate replace to="/login" />;
  if (user?.mustChangePassword) return <Navigate replace to="/cambiar-contrasena" />;
  if (user?.platformRole !== 'PLATFORM_ADMIN') return <Navigate replace to="/dashboard" />;

  return <Outlet />;
}
