import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegalPage } from './LegalPage';

const documents = ['privacy', 'terms', 'cookies', 'refunds'] as const;

describe('LegalPage', () => {
  it.each(documents)('renders the %s document with its pending-data notice', (document) => {
    render(
      <MemoryRouter>
        <LegalPage document={document} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/documento informativo pendiente de completar/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Easyvet, inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Más información legal' })).toBeInTheDocument();
  });

  it('keeps commercial and identity placeholders explicit until the owner supplies real data', () => {
    render(
      <MemoryRouter>
        <LegalPage document="terms" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/identidad legal, razón social, NIT/i)).toBeInTheDocument();
    expect(screen.getByText(/precios, impuestos, descuento anual/i)).toBeInTheDocument();
    expect(screen.getByText(/sin reembolsos, sujeta a la ley colombiana/i)).toBeInTheDocument();
  });
});
