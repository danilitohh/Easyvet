import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { PageHeader } from '../ui/PageHeader';
import type { NavigationItem } from '../../data/navigation';

type ModulePlaceholderProps = {
  route: NavigationItem;
};

// Placeholders make the future information architecture navigable without inventing domain logic.
export function ModulePlaceholder({ route }: ModulePlaceholderProps) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Módulo en preparación"
        title={route.label}
        description={route.description}
        action={
          <Button variant="secondary" type="button" disabled>
            Próximamente
          </Button>
        }
      />
      <Card className="placeholder-card">
        <EmptyState
          icon={route.icon}
          title="Este módulo se implementará en una fase posterior."
          description="La ruta ya está preparada para que el dominio se diseñe con decisiones de producto y datos reales."
        />
      </Card>
    </div>
  );
}
