import { appConfig } from '../../config/app';

type BrandMarkProps = {
  compact?: boolean;
};

// The temporary mark is a neutral monogram until Easyvet branding is decided.
export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'} aria-hidden="true">
      {appConfig.shortName.slice(0, 1).toUpperCase()}
    </span>
  );
}
