import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the temporary home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /clean foundation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check api health/i })).toHaveAttribute(
      'href',
      '/health',
    );
  });
});
