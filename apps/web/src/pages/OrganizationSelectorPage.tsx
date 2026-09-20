import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/useAuth';

// OrganizationSelectorPage makes the tenant context explicit when a user belongs to several clinics.
export function OrganizationSelectorPage() {
  const navigate = useNavigate();
  const { memberships, switchOrganization } = useAuth();
  const [error, setError] = useState('');

  async function select(membershipId: string) {
    setError('');
    try {
      await switchOrganization(membershipId);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('No fue posible seleccionar esa organización.');
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">Contexto de trabajo</p>
        <h1>Elige una organización</h1>
        <p className="auth-card__intro">Selecciona la clínica que quieres administrar.</p>
        <div className="organization-list">
          {memberships.map((membership) => (
            <Button
              key={membership.id}
              variant="secondary"
              fullWidth
              type="button"
              onClick={() => void select(membership.id)}
            >
              <span>{membership.organization.name}</span>
              <small>{membership.role}</small>
            </Button>
          ))}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>
    </main>
  );
}
