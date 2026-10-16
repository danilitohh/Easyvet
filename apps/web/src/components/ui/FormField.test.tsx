import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';
import { TextInput } from './TextInput';

describe('FormField', () => {
  it('associates helper text with the control and preserves existing descriptions', () => {
    render(
      <FormField label="Contraseña" htmlFor="password" hint="Usa al menos 12 caracteres.">
        <TextInput id="password" aria-describedby="password-policy" />
      </FormField>,
    );

    const input = screen.getByLabelText('Contraseña');
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(describedBy).toContain('password-policy');
    expect(describedBy).toHaveLength(2);
    expect(
      document.getElementById(describedBy.find((id) => id !== 'password-policy')!),
    ).toHaveTextContent('Usa al menos 12 caracteres.');
  });

  it('keeps label association when no helper text is provided', () => {
    render(
      <FormField label="Correo" htmlFor="email">
        <TextInput id="email" type="email" />
      </FormField>,
    );

    expect(screen.getByLabelText('Correo')).toHaveAttribute('id', 'email');
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-describedby');
  });
});
