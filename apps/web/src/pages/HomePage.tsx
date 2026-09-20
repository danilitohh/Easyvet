import { Link } from 'react-router-dom';

// Home documents the deliberate scope boundary instead of pretending a domain module exists.
export function HomePage() {
  return (
    <section className="hero-card" aria-labelledby="home-title">
      <p className="eyebrow">Independent monorepo</p>
      <h2 id="home-title">A clean foundation for veterinary software.</h2>
      <p className="lede">
        React, Vite, NestJS, PostgreSQL and Prisma are wired together without importing legacy
        screens, data, credentials or business modules.
      </p>
      <div className="scope-grid">
        <article>
          <strong>Ready</strong>
          <span>Routing, shared contracts and strict TypeScript.</span>
        </article>
        <article>
          <strong>Next</strong>
          <span>Domain decisions before the first veterinary module.</span>
        </article>
      </div>
      <Link className="primary-action" to="/health">
        Check API health
      </Link>
    </section>
  );
}
