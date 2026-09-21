import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { MODULE_ROUTES } from '../data/navigation';
import { DashboardPage } from '../pages/DashboardPage';
import { HealthPage } from '../pages/HealthPage';
import { ModulePage } from '../pages/ModulePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { OrganizationSelectorPage } from '../pages/OrganizationSelectorPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { AuthBoundary } from './AuthBoundary';
import { PERMISSION } from '../auth/permissions';
import { PermissionRoute } from '../features/shared/ResourceFeedback';
import { OwnerListPage } from '../features/owners/OwnerListPage';
import { OwnerDetailPage } from '../features/owners/OwnerDetailPage';
import { OwnerFormPage } from '../features/owners/OwnerFormPage';
import { PatientListPage } from '../features/patients/PatientListPage';
import { PatientDetailPage } from '../features/patients/PatientDetailPage';
import { PatientFormPage } from '../features/patients/PatientFormPage';
import { AgendaPage } from '../features/agenda/AgendaPage';
import { AppointmentFormPage } from '../features/agenda/AppointmentFormPage';

// Route declarations keep every product area addressable without hiding sections in the DOM.
export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<AuthBoundary />}>
        <Route path="seleccionar-organizacion" element={<OrganizationSelectorPage />} />
        <Route path="acceso-denegado" element={<AccessDeniedPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route
            path="agenda"
            element={
              <PermissionRoute permission={PERMISSION.APPOINTMENTS_READ}>
                <AgendaPage />
              </PermissionRoute>
            }
          />
          <Route
            path="agenda/citas/:appointmentId"
            element={
              <PermissionRoute permission={PERMISSION.APPOINTMENTS_READ}>
                <AgendaPage />
              </PermissionRoute>
            }
          />
          <Route
            path="agenda/nueva"
            element={
              <PermissionRoute permission={PERMISSION.APPOINTMENTS_CREATE}>
                <AppointmentFormPage mode="create" />
              </PermissionRoute>
            }
          />
          <Route
            path="agenda/citas/:appointmentId/editar"
            element={
              <PermissionRoute permission={PERMISSION.APPOINTMENTS_UPDATE}>
                <AppointmentFormPage mode="edit" />
              </PermissionRoute>
            }
          />
          <Route
            path="agenda/citas/:appointmentId/reprogramar"
            element={
              <PermissionRoute permission={PERMISSION.APPOINTMENTS_UPDATE}>
                <AppointmentFormPage mode="reschedule" />
              </PermissionRoute>
            }
          />
          <Route
            path="propietarios"
            element={
              <PermissionRoute permission={PERMISSION.OWNERS_READ}>
                <OwnerListPage />
              </PermissionRoute>
            }
          />
          <Route
            path="propietarios/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.OWNERS_CREATE}>
                <OwnerFormPage mode="create" />
              </PermissionRoute>
            }
          />
          <Route
            path="propietarios/:ownerId"
            element={
              <PermissionRoute permission={PERMISSION.OWNERS_READ}>
                <OwnerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="propietarios/:ownerId/editar"
            element={
              <PermissionRoute permission={PERMISSION.OWNERS_UPDATE}>
                <OwnerFormPage mode="edit" />
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes"
            element={
              <PermissionRoute permission={PERMISSION.PATIENTS_READ}>
                <PatientListPage />
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.PATIENTS_CREATE}>
                <PatientFormPage mode="create" />
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId"
            element={
              <PermissionRoute permission={PERMISSION.PATIENTS_READ}>
                <PatientDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/editar"
            element={
              <PermissionRoute permission={PERMISSION.PATIENTS_UPDATE}>
                <PatientFormPage mode="edit" />
              </PermissionRoute>
            }
          />
          {MODULE_ROUTES.filter(
            (route) =>
              route.path !== '/dashboard' &&
              route.path !== '/agenda' &&
              route.path !== '/propietarios' &&
              route.path !== '/pacientes',
          ).map((route) => (
            <Route
              key={route.path}
              path={route.path.slice(1)}
              element={<ModulePage route={route} />}
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
