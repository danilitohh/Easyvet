import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
};

// FormField centralizes label and helper text associations for future forms.
export function FormField({ label, htmlFor, hint, children }: FormFieldProps) {
  const hintId = useId();
  const fieldControl = hint
    ? Children.map(children, (child) => {
        if (!isValidElement<Record<string, unknown>>(child)) return child;

        const existingDescription = child.props['aria-describedby'];
        const descriptionIds =
          typeof existingDescription === 'string'
            ? existingDescription.split(/\s+/).filter(Boolean)
            : [];
        const describedBy = [...new Set([...descriptionIds, hintId])].join(' ');

        return cloneElement(child, { 'aria-describedby': describedBy });
      })
    : children;

  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {fieldControl}
      {hint ? (
        <span id={hintId} className="form-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
