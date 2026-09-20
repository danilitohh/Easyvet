import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { appConfig } from '../../config/app';
import type { NavigationItem } from '../../data/navigation';

type AppHeaderProps = {
  route: NavigationItem;
  onOpenMenu: () => void;
};

// Header exposes the active route, mobile navigation and the explicit demo boundary.
export function AppHeader({ route, onOpenMenu }: AppHeaderProps) {
  const [demoNoticeOpen, setDemoNoticeOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="app-header__mobile-brand">
          <BrandMark compact />
          <strong>{appConfig.shortName}</strong>
        </div>
        <button
          className="menu-button icon-button"
          type="button"
          aria-label="Abrir navegación"
          onClick={onOpenMenu}
        >
          ☰
        </button>
        <div className="breadcrumb">
          <span className="breadcrumb__root">{appConfig.shortName}</span>
          <span aria-hidden="true">/</span>
          <strong>{route.label}</strong>
        </div>
        <div className="app-header__actions">
          <Button variant="ghost" type="button" onClick={() => setDemoNoticeOpen(true)}>
            Datos demo
          </Button>
          <Link
            className="user-chip"
            to="/configuracion"
            aria-label="Abrir configuración del workspace demo"
          >
            <span className="user-chip__avatar">DS</span>
            <span className="user-chip__copy">
              <strong>Demo workspace</strong>
              <small>Vista previa</small>
            </span>
          </Link>
        </div>
      </header>
      <Modal
        open={demoNoticeOpen}
        onClose={() => setDemoNoticeOpen(false)}
        title="Datos de demostración"
        description="El shell visual no está conectado a datos clínicos ni a autenticación."
      >
        <p className="modal-note">
          Las cifras del dashboard son pequeñas muestras ficticias para validar jerarquía,
          navegación y estados visuales.
        </p>
      </Modal>
    </>
  );
}
