import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { findUnnamedActions, findUnlabeledFormControls } from '../../test/accessibility';
import { ResourceError } from './ResourceFeedback';

vi.mock('../../auth/useCan', () => ({
  useCan: () => true,
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ activeMembership: null }),
}));

describe('shared remote-state accessibility', () => {
  it('announces loading state with a meaningful status label', () => {
    const view = render(<LoadingState label="Cargando historia clínica" />);

    expect(screen.getByRole('status', { name: 'Cargando historia clínica' })).toBeInTheDocument();
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });

  it('gives empty states a heading, explanation and named action', () => {
    const view = render(
      <EmptyState
        title="Sin documentos"
        description="Todavía no hay documentos para este paciente."
        action={<button type="button">Subir documento</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sin documentos' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay documentos para este paciente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument();
    expect(view.container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });

  it('exposes retryable remote errors as an alert with an actionable button', () => {
    const onRetry = vi.fn();
    const view = render(
      <ResourceError
        error={new Error('fallo de red')}
        fallback="No fue posible cargar el registro."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No fue posible cargar el registro.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });

  it('provides a navigable not-found state for detail routes', () => {
    const view = render(
      <MemoryRouter initialEntries={['/pacientes/luna/historia']}>
        <ResourceError error={new ApiError('No existe', 404, 'RESOURCE_NOT_FOUND')} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Recurso no encontrado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/');
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });
});
