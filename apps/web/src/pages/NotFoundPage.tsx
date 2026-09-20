import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

// NotFound keeps unknown URLs inside the same shell and offers a clear recovery path.
export function NotFoundPage() {
  return (
    <Card className="not-found-card">
      <EmptyState
        icon="?"
        title="No encontramos esa vista."
        description="La dirección no corresponde a una sección disponible en este shell."
        action={
          <Link className="button button--primary" to="/dashboard">
            Ir al dashboard
          </Link>
        }
      />
    </Card>
  );
}
