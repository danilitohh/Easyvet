type BrandMarkProps = {
  compact?: boolean;
};

// The official Easyvet mark is supplied as a transparent image so it stays
// faithful to the approved logo across the public and operational surfaces.
export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'} aria-hidden="true">
      <img className="brand-mark__image" src="/brand/easyvet-mark.png" alt="" width="1030" height="820" />
    </span>
  );
}
