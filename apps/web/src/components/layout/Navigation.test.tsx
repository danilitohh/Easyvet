import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

const permissionState = vi.hoisted(() => ({ allowed: [] as string[] }));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => permissionState.allowed.includes(permission),
}));

function renderSidebar(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar
        open={false}
        collapsed={false}
        onClose={() => undefined}
        onToggleCollapse={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('role-aware navigation', () => {
  beforeEach(() => {
    permissionState.allowed = [];
  });

  it('hides module links the active member cannot read', () => {
    permissionState.allowed = [PERMISSION.INVENTORY_READ];
    renderSidebar('/inventario');

    expect(screen.getByRole('link', { name: 'Inventario' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'Pacientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Propietarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('keeps a module active on its nested detail routes', () => {
    permissionState.allowed = [PERMISSION.INVENTORY_READ];
    renderSidebar('/inventario/item-1');

    expect(screen.getByRole('link', { name: 'Inventario' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps Agenda active on appointment routes without activating it for availability', () => {
    permissionState.allowed = [PERMISSION.APPOINTMENTS_READ, PERMISSION.AVAILABILITY_READ];
    const { unmount } = renderSidebar('/agenda/citas/appointment-1/editar');

    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Disponibilidad' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );

    unmount();
    renderSidebar('/agenda/disponibilidad');

    expect(screen.getByRole('link', { name: 'Disponibilidad' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not turn the organization identity into an unauthorized settings link', () => {
    render(
      <MemoryRouter>
        <AppHeader
          route={{ label: 'Dashboard', path: '/dashboard', icon: '⌂', description: '' }}
          onOpenMenu={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /abrir configuración/i })).not.toBeInTheDocument();
  });
});
