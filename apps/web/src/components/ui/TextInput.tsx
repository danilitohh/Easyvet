import type { InputHTMLAttributes } from 'react';

// TextInput is the accessible, style-consistent text primitive for future modules.
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}
