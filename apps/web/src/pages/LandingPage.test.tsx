import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('identifies the dashboard preview data as illustrative', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Vista demostrativa · Los nombres y las cifras son ilustrativos.'),
    ).toBeInTheDocument();
  });
});
