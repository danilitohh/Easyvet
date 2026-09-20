import type { ElementType, ComponentPropsWithoutRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps<T extends ElementType = 'button'> = {
  as?: T;
  variant?: ButtonVariant;
  fullWidth?: boolean;
} & ComponentPropsWithoutRef<T>;

// Shared action styling keeps buttons consistent across the shell and future modules.
export function Button<T extends ElementType = 'button'>({
  as,
  variant = 'primary',
  fullWidth = false,
  className,
  ...props
}: ButtonProps<T>) {
  const Component = as ?? ('button' as ElementType);
  const classes = ['button', `button--${variant}`, fullWidth ? 'button--full' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return <Component className={classes} {...props} />;
}
