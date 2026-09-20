import type { ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
};

// FormField centralizes label and helper text associations for future forms.
export function FormField({ label, htmlFor, hint, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="form-field__hint">{hint}</span> : null}
    </div>
  );
}
