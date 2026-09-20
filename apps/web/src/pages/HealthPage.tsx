import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { appConfig } from '../config/app';
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
    <div className="page-stack">
      <PageHeader
        eyebrow="Technical check"
        title="Service health"
        description="A small diagnostic surface for the existing API contract."
        action={
          <Button as={Link} to="/dashboard" variant="secondary">
            Back to dashboard
          </Button>
        }
      />
      <Card className="health-card">
        <div className="health-card__heading">
          <div>
            <p className="section-kicker">GET /api/v1/health</p>
            <h2 id="health-title">Connection status</h2>
          </div>
          <span className="health-card__mode">{appConfig.dataMode} mode</span>
        </div>
        {health.status === 'loading' && <LoadingState label="Checking the API" />}
        {health.status === 'ready' && (
          <Alert tone="success" role="status">
            API status: {health.value}
          </Alert>
        )}
        {health.status === 'error' && (
          <Alert tone="error" role="alert">
            API unavailable: {health.message}
          </Alert>
        )}
      </Card>
    </div>
  );
}
