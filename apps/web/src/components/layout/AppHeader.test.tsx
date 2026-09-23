import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationItem } from '../../data/navigation';
import { AppHeader } from './AppHeader';

const headerMocks = vi.hoisted(() => ({
  memberships: [] as Array<{ id: string }>,
  activeMembership: {
    organization: { name: 'Veterinaria Demo Norte' },
    permissions: [],
  },
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'multi@demo.local' },
    activeMembership: headerMocks.activeMembership,
    memberships: headerMocks.memberships,
    logout: vi.fn(),
  }),
}));

// HeaderHarness mounts the reusable application header with an in-memory route context.
function HeaderHarness() {
  const route = { path: '/inventario', label: 'Inventario' } as NavigationItem;
  return (
    <MemoryRouter>
      <AppHeader route={route} onOpenMenu={vi.fn()} />
    </MemoryRouter>
  );
}

describe('AppHeader tenant context', () => {
  beforeEach(() => {
    headerMocks.memberships = [{ id: 'north' }];
  });

  it('offers an in-app organization switch when multiple memberships are available', () => {
    headerMocks.memberships = [{ id: 'north' }, { id: 'south' }];
    render(<HeaderHarness />);

    expect(screen.getByRole('link', { name: /cambiar organización desde/i })).toHaveAttribute(
      'href',
      '/seleccionar-organizacion',
    );
  });

  it('does not show a switch when the user has one active membership', () => {
    render(<HeaderHarness />);

    expect(screen.queryByRole('link', { name: /cambiar organización desde/i })).toBeNull();
  });
});
