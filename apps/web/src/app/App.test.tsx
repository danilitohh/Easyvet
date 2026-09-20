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
  it('redirects the root route to the dashboard', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: /una vista tranquila/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir agenda/i })).toHaveAttribute('href', '/agenda');
  });

  it('renders a navigable placeholder and marks its route active', () => {
    renderApp('/pacientes');

    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByText(/se implementará en una fase posterior/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pacientes' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates from the sidebar without hiding routes in the DOM', () => {
    renderApp('/dashboard');

    fireEvent.click(screen.getByRole('link', { name: 'Agenda' }));

    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders a shell-level not found page for unknown URLs', () => {
    renderApp('/no-existe');

    expect(screen.getByRole('heading', { name: /no encontramos esa vista/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
