import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('renders the public landing page at the root route', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: /más tiempo para cuidar/i })).toBeInTheDocument();
    const loginLinks = screen.getAllByRole('link', { name: /entrar a easyvet/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    loginLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    expect(screen.queryByRole('link', { name: 'Estado técnico' })).not.toBeInTheDocument();
  });

  it('renders an access boundary for a route without an active membership', () => {
    renderApp('/pacientes');

    expect(screen.getByRole('heading', { name: /no tienes permisos/i })).toBeInTheDocument();
    expect(screen.queryByText(/se implementará en una fase posterior/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pacientes' })).not.toBeInTheDocument();
  });

  it('protects appointment scheduling routes with the create permission', () => {
    renderApp('/agenda/nueva');

    expect(screen.getByRole('heading', { name: /no tienes permisos/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nueva cita' })).not.toBeInTheDocument();
  });

  it('navigates from the sidebar to an available technical route', () => {
    renderApp('/dashboard');

    fireEvent.click(screen.getByRole('link', { name: 'Estado técnico' }));

    expect(screen.getByRole('heading', { name: 'Service health' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Estado técnico' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders a shell-level not found page for unknown URLs', () => {
    renderApp('/no-existe');

    expect(screen.getByRole('heading', { name: /no encontramos esa vista/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('does not route obsolete module links to a fake coming-soon screen', () => {
    renderApp('/vacunas');

    expect(screen.getByRole('heading', { name: /no encontramos esa vista/i })).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vacunas' })).not.toBeInTheDocument();
  });
});
