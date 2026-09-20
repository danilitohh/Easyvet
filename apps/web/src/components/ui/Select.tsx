import type { SelectHTMLAttributes } from 'react';

// Select keeps native keyboard and screen-reader behavior while sharing form tokens.
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}
