import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlatformShell } from './PlatformShell';

describe('PlatformShell navigation icons', () => {
  it('uses the five isolated Easyvet image assets instead of text glyphs', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/plataforma/clinicas']}>
        <PlatformShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Clínicas' })).toBeInTheDocument();
    const icons = [...container.querySelectorAll('.platform-nav__icon img')];
    expect(icons).toHaveLength(5);
    expect(icons.map((icon) => icon.getAttribute('src'))).toEqual([
      '/icons-3d/platform/overview.png',
      '/icons-3d/platform/clinics.png',
      '/icons-3d/platform/plans.png',
      '/icons-3d/platform/accounts.png',
      '/icons-3d/platform/audit.png',
    ]);
    expect(icons.every((icon) => icon.getAttribute('alt') === '')).toBe(true);
  });
});
