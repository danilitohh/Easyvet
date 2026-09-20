import { useEffect, useState } from 'react';
import { fetchHealth } from '../services/health';

type HealthState =
  { status: 'loading' } | { status: 'ready'; value: string } | { status: 'error'; message: string };

// The page proves the browser-to-API contract without introducing a data module.
export function HealthPage() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal)
      .then((payload) => setHealth({ status: 'ready', value: payload.status }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown health error';
        setHealth({ status: 'error', message });
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="status-card" aria-labelledby="health-title">
      <p className="eyebrow">API contract</p>
      <h2 id="health-title">Service health</h2>
      {health.status === 'loading' && <p role="status">Checking the API…</p>}
      {health.status === 'ready' && (
        <p className="status-ok" role="status">
          API status: {health.value}
        </p>
      )}
      {health.status === 'error' && (
        <p className="status-error" role="alert">
          API unavailable: {health.message}
        </p>
      )}
    </section>
  );
}
