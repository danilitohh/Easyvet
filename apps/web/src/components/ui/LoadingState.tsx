type LoadingStateProps = {
  label?: string;
};

// Skeleton rows preserve layout while a future remote module loads.
export function LoadingState({ label = 'Cargando' }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-label={label}>
      <span className="loading-state__bar" />
      <span className="loading-state__bar loading-state__bar--short" />
      <span className="loading-state__bar" />
    </div>
  );
}
