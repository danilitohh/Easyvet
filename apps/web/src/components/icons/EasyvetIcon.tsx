import type { SVGProps } from 'react';

export type EasyvetIconName =
  | 'activity'
  | 'arrow-down'
  | 'arrow-up-right'
  | 'bar-chart'
  | 'calendar'
  | 'calendar-heart'
  | 'check'
  | 'clipboard-heart'
  | 'heart-pulse'
  | 'package'
  | 'paw'
  | 'receipt'
  | 'sparkle';

type EasyvetIconProps = SVGProps<SVGSVGElement> & {
  name: EasyvetIconName;
  size?: number | string;
};

function IconPaths({ name }: Pick<EasyvetIconProps, 'name'>) {
  switch (name) {
    case 'activity':
      return <path d="M3 12h4l2-5 4 10 2-5h6" />;
    case 'arrow-down':
      return <><path d="M12 4v15" /><path d="m6 13 6 6 6-6" /></>;
    case 'arrow-up-right':
      return <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>;
    case 'bar-chart':
      return <><path d="M4 20V13h3v7" /><path d="M10.5 20V9h3v11" /><path d="M17 20V4h3v16" /></>;
    case 'calendar':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
        </>
      );
    case 'calendar-heart':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path
            className="easyvet-icon__accent"
            d="M12 18.1s-3.15-1.8-3.15-4a1.75 1.75 0 0 1 3.15-1.08A1.75 1.75 0 0 1 15.15 14c0 2.2-3.15 4.1-3.15 4.1Z"
          />
          <path d="M12 18.1s-3.15-1.8-3.15-4a1.75 1.75 0 0 1 3.15-1.08A1.75 1.75 0 0 1 15.15 14c0 2.2-3.15 4.1-3.15 4.1Z" />
        </>
      );
    case 'check':
      return <path d="m5 12 4 4L19 6" />;
    case 'clipboard-heart':
      return (
        <>
          <rect x="5" y="4.5" width="14" height="17" rx="2" />
          <path d="M9 4.5V3h6v1.5" />
          <path d="M12 17.5s-3.2-1.9-3.2-4a1.8 1.8 0 0 1 3.2-1.1 1.8 1.8 0 0 1 3.2 1.1c0 2.1-3.2 4-3.2 4Z" />
        </>
      );
    case 'heart-pulse':
      return (
        <>
          <path
            className="easyvet-icon__accent"
            d="M12 20.1s-7.1-4.2-7.1-9.2a4.15 4.15 0 0 1 7.1-2.86A4.15 4.15 0 0 1 19.1 10.9c0 5-7.1 9.2-7.1 9.2Z"
          />
          <path d="M12 20.1s-7.1-4.2-7.1-9.2a4.15 4.15 0 0 1 7.1-2.86A4.15 4.15 0 0 1 19.1 10.9c0 5-7.1 9.2-7.1 9.2Z" />
          <path d="M3 12h3l1.4-2.5 2.2 5 1.8-3.2 1.5 2.7H21" />
        </>
      );
    case 'package':
      return (
        <>
          <path className="easyvet-icon__accent" d="m3.5 7 8.5 4 8.5-4-8.5-4-8.5 4Z" />
          <path d="m3.5 7 8.5-4 8.5 4-8.5 4-8.5-4Z" />
          <path d="M3.5 7v10l8.5 4 8.5-4V7M12 11v10" />
          <path d="m7.5 5.1 8.5 4" />
        </>
      );
    case 'paw':
      return (
        <>
          <circle cx="7.2" cy="7.3" r="1.7" />
          <circle cx="16.8" cy="7.3" r="1.7" />
          <circle cx="4.8" cy="12" r="1.6" />
          <circle cx="19.2" cy="12" r="1.6" />
          <path
            className="easyvet-icon__accent"
            d="M8.2 16.2c0-2.3 1.7-4.1 3.8-4.1s3.8 1.8 3.8 4.1c0 1.7-1.2 2.8-2.8 2.8h-2c-1.6 0-2.8-1.1-2.8-2.8Z"
          />
          <path d="M8.2 16.2c0-2.3 1.7-4.1 3.8-4.1s3.8 1.8 3.8 4.1c0 1.7-1.2 2.8-2.8 2.8h-2c-1.6 0-2.8-1.1-2.8-2.8Z" />
        </>
      );
    case 'receipt':
      return (
        <>
          <path className="easyvet-icon__accent" d="M7.5 6.2h9v12h-9z" />
          <path d="M5 3.5h14v18l-3.5-2-3.5 2-3.5-2-3.5 2v-18Z" />
          <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
        </>
      );
    case 'sparkle':
      return <path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" />;
  }
}

// A small source-owned icon family for the marketing surface. SVG keeps the
// icons crisp, themeable and independent from an external icon font.
export function EasyvetIcon({ name, size = 18, ...props }: EasyvetIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={['easyvet-icon', props.className].filter(Boolean).join(' ')}
      data-icon={name}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <IconPaths name={name} />
    </svg>
  );
}
