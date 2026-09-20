import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

// AccessDenied distinguishes authorization failures from missing cross-tenant resources.
export function AccessDeniedPage() {
  return (
    <Card className="access-denied-card">
      <p className="eyebrow">Acceso restringido</p>
      <h1>No tienes permisos para esta acción</h1>
      <p>Solicita acceso a un administrador de tu organización.</p>
      <Link className="button button--secondary" to="/dashboard">
        Volver al dashboard
      </Link>
    </Card>
  );
}
