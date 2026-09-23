import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function FailingPage(): ReactNode {
  throw new Error('private implementation detail');
}

describe('AppErrorBoundary', () => {
  it('replaces a crashed page with a safe recovery message', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <FailingPage />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esta vista');
    expect(screen.queryByText('private implementation detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar aplicación' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
