import type { CSSProperties, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type ParticleStyle = CSSProperties & {
  '--particle-x': string;
  '--particle-y': string;
  '--particle-delay': string;
  '--particle-size': string;
};

const particles = [
  ['-24px', '-28px', '0ms', '4px'],
  ['4px', '-34px', '45ms', '3px'],
  ['29px', '-22px', '90ms', '5px'],
  ['38px', '8px', '135ms', '3px'],
  ['-35px', '12px', '180ms', '5px'],
  ['-20px', '34px', '225ms', '3px'],
  ['8px', '38px', '270ms', '4px'],
  ['28px', '29px', '315ms', '3px'],
] as const;

type ParticleLinkProps = LinkProps & {
  children: ReactNode;
};

// KokonutUI-inspired particle CTA adapted to React Router and Easyvet's palette.
export function ParticleLink({ children, className = '', ...props }: ParticleLinkProps) {
  return (
    <Link {...props} className={['kk-particle-link', className].filter(Boolean).join(' ')}>
      <span className="kk-particle-link__particles" aria-hidden="true">
        {particles.map(([x, y, delay, size], index) => (
          <i
            className="kk-particle-link__particle"
            key={`${x}-${y}-${index}`}
            style={
              {
                '--particle-x': x,
                '--particle-y': y,
                '--particle-delay': delay,
                '--particle-size': size,
              } as ParticleStyle
            }
          />
        ))}
      </span>
      <span className="kk-particle-link__content">{children}</span>
    </Link>
  );
}
