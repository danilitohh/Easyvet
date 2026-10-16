import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthBoundary } from './AuthBoundary';
import { PlatformAdminBoundary } from './PlatformAdminBoundary';
import { AppErrorBoundary } from './AppErrorBoundary';
import { PERMISSION } from '../auth/permissions';
import { AnyPermissionRoute, PermissionRoute } from '../features/shared/ResourceFeedback';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';

const AppShell = lazy(() =>
  import('../components/layout/AppShell').then((module) => ({ default: module.AppShell })),
);
const PlatformShell = lazy(() =>
  import('../components/layout/PlatformShell').then((module) => ({
    default: module.PlatformShell,
  })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const HealthPage = lazy(() =>
  import('../pages/HealthPage').then((module) => ({ default: module.HealthPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegistrationPage = lazy(() =>
  import('../pages/RegistrationPage').then((module) => ({ default: module.RegistrationPage })),
);
const PlatformAdminBootstrapPage = lazy(() =>
  import('../pages/PlatformAdminBootstrapPage').then((module) => ({
    default: module.PlatformAdminBootstrapPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import('../pages/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })),
);
const PasswordResetRequestPage = lazy(() =>
  import('../pages/PasswordResetRequestPage').then((module) => ({
    default: module.PasswordResetRequestPage,
  })),
);
const PasswordResetPage = lazy(() =>
  import('../pages/PasswordResetPage').then((module) => ({ default: module.PasswordResetPage })),
);
const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const OrganizationSelectorPage = lazy(() =>
  import('../pages/OrganizationSelectorPage').then((module) => ({
    default: module.OrganizationSelectorPage,
  })),
);

const OwnerListPage = lazy(() =>
  import('../features/owners/OwnerListPage').then((module) => ({ default: module.OwnerListPage })),
);
const OwnerDetailPage = lazy(() =>
  import('../features/owners/OwnerDetailPage').then((module) => ({
    default: module.OwnerDetailPage,
  })),
);
const OwnerFormPage = lazy(() =>
  import('../features/owners/OwnerFormPage').then((module) => ({ default: module.OwnerFormPage })),
);
const PatientListPage = lazy(() =>
  import('../features/patients/PatientListPage').then((module) => ({
    default: module.PatientListPage,
  })),
);
const PatientDetailPage = lazy(() =>
  import('../features/patients/PatientDetailPage').then((module) => ({
    default: module.PatientDetailPage,
  })),
);
const PatientFormPage = lazy(() =>
  import('../features/patients/PatientFormPage').then((module) => ({
    default: module.PatientFormPage,
  })),
);
const AgendaPage = lazy(() =>
  import('../features/agenda/AgendaPage').then((module) => ({ default: module.AgendaPage })),
);
const AppointmentFormPage = lazy(() =>
  import('../features/agenda/AppointmentFormPage').then((module) => ({
    default: module.AppointmentFormPage,
  })),
);
const AvailabilityPage = lazy(() =>
  import('../features/agenda/AvailabilityPage').then((module) => ({
    default: module.AvailabilityPage,
  })),
);

const ClinicalHistoryPage = lazy(() =>
  import('../features/clinical/ClinicalHistoryPage').then((module) => ({
    default: module.ClinicalHistoryPage,
  })),
);
const ClinicalEncounterDetailPage = lazy(() =>
  import('../features/clinical/ClinicalEncounterDetailPage').then((module) => ({
    default: module.ClinicalEncounterDetailPage,
  })),
);
const ProfessionalProfilePage = lazy(() =>
  import('../features/clinical/ProfessionalProfilePage').then((module) => ({
    default: module.ProfessionalProfilePage,
  })),
);
const ClinicalEncounterFormPage = lazy(() =>
  import('../features/clinical/ClinicalEncounterFormPage').then((module) => ({
    default: module.ClinicalEncounterFormPage,
  })),
);
const ClinicalEvolutionFormPage = lazy(() =>
  import('../features/clinical/ClinicalEvolutionFormPage').then((module) => ({
    default: module.ClinicalEvolutionFormPage,
  })),
);
const PrescriptionListPage = lazy(() =>
  import('../features/prescriptions/PrescriptionListPage').then((module) => ({
    default: module.PrescriptionListPage,
  })),
);
const PrescriptionDetailPage = lazy(() =>
  import('../features/prescriptions/PrescriptionDetailPage').then((module) => ({
    default: module.PrescriptionDetailPage,
  })),
);
const PrescriptionFormPage = lazy(() =>
  import('../features/prescriptions/PrescriptionFormPage').then((module) => ({
    default: module.PrescriptionFormPage,
  })),
);
const PreventiveCarePage = lazy(() =>
  import('../features/preventive-care/PreventiveCarePage').then((module) => ({
    default: module.PreventiveCarePage,
  })),
);
const VaccinationDetailPage = lazy(() =>
  import('../features/preventive-care/VaccinationDetailPage').then((module) => ({
    default: module.VaccinationDetailPage,
  })),
);
const DewormingDetailPage = lazy(() =>
  import('../features/preventive-care/DewormingDetailPage').then((module) => ({
    default: module.DewormingDetailPage,
  })),
);
const VaccinationFormPage = lazy(() =>
  import('../features/preventive-care/PreventiveFormPage').then((module) => ({
    default: module.VaccinationFormPage,
  })),
);
const DewormingFormPage = lazy(() =>
  import('../features/preventive-care/PreventiveFormPage').then((module) => ({
    default: module.DewormingFormPage,
  })),
);
const ProceduresAnesthesiaListPage = lazy(() =>
  import('../features/procedures/ProceduresAnesthesiaListPage').then((module) => ({
    default: module.ProceduresAnesthesiaListPage,
  })),
);
const ProcedureDetailPage = lazy(() =>
  import('../features/procedures/ProcedureDetailPage').then((module) => ({
    default: module.ProcedureDetailPage,
  })),
);
const ProcedureFormPage = lazy(() =>
  import('../features/procedures/ProcedureFormPage').then((module) => ({
    default: module.ProcedureFormPage,
  })),
);
const AnesthesiaDetailPage = lazy(() =>
  import('../features/anesthesia/AnesthesiaDetailPage').then((module) => ({
    default: module.AnesthesiaDetailPage,
  })),
);
const AnesthesiaFormPage = lazy(() =>
  import('../features/anesthesia/AnesthesiaFormPage').then((module) => ({
    default: module.AnesthesiaFormPage,
  })),
);
const HospitalizationListPage = lazy(() =>
  import('../features/hospitalizations/HospitalizationListPage').then((module) => ({
    default: module.HospitalizationListPage,
  })),
);
const HospitalizationDetailPage = lazy(() =>
  import('../features/hospitalizations/HospitalizationDetailPage').then((module) => ({
    default: module.HospitalizationDetailPage,
  })),
);
const HospitalizationFormPage = lazy(() =>
  import('../features/hospitalizations/HospitalizationFormPage').then((module) => ({
    default: module.HospitalizationFormPage,
  })),
);
const DiagnosticOrderListPage = lazy(() =>
  import('../features/diagnostics/DiagnosticOrderListPage').then((module) => ({
    default: module.DiagnosticOrderListPage,
  })),
);
const DiagnosticOrderDetailPage = lazy(() =>
  import('../features/diagnostics/DiagnosticOrderDetailPage').then((module) => ({
    default: module.DiagnosticOrderDetailPage,
  })),
);
const DiagnosticOrderFormPage = lazy(() =>
  import('../features/diagnostics/DiagnosticOrderFormPage').then((module) => ({
    default: module.DiagnosticOrderFormPage,
  })),
);
const DocumentsPage = lazy(() =>
  import('../features/documents/DocumentsPage').then((module) => ({
    default: module.DocumentsPage,
  })),
);
const ConsentsPage = lazy(() =>
  import('../features/documents/ConsentsPage').then((module) => ({ default: module.ConsentsPage })),
);
const ConsentDetailPage = lazy(() =>
  import('../features/documents/ConsentDetailPage').then((module) => ({
    default: module.ConsentDetailPage,
  })),
);
const ConsentFormPage = lazy(() =>
  import('../features/documents/ConsentFormPage').then((module) => ({
    default: module.ConsentFormPage,
  })),
);
const PublicSignaturePage = lazy(() =>
  import('../features/documents/PublicSignaturePage').then((module) => ({
    default: module.PublicSignaturePage,
  })),
);
const FollowUpsPage = lazy(() =>
  import('../features/follow-ups/FollowUpsPages').then((module) => ({
    default: module.FollowUpsPage,
  })),
);
const FollowUpDetailPage = lazy(() =>
  import('../features/follow-ups/FollowUpsPages').then((module) => ({
    default: module.FollowUpDetailPage,
  })),
);
const FollowUpFormPage = lazy(() =>
  import('../features/follow-ups/FollowUpsPages').then((module) => ({
    default: module.FollowUpFormPage,
  })),
);
const PatientFollowUpsPage = lazy(() =>
  import('../features/follow-ups/FollowUpsPages').then((module) => ({
    default: module.PatientFollowUpsPage,
  })),
);
const GroomingQueuePage = lazy(() =>
  import('../features/grooming/GroomingPages').then((module) => ({
    default: module.GroomingQueuePage,
  })),
);
const GroomingFormPage = lazy(() =>
  import('../features/grooming/GroomingPages').then((module) => ({
    default: module.GroomingFormPage,
  })),
);
const GroomingVisitDetailPage = lazy(() =>
  import('../features/grooming/GroomingPages').then((module) => ({
    default: module.GroomingVisitDetailPage,
  })),
);
const GroomingHistoryPage = lazy(() =>
  import('../features/grooming/GroomingPages').then((module) => ({
    default: module.GroomingHistoryPage,
  })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const InventoryItemDetailPage = lazy(() =>
  import('../features/inventory/InventoryItemDetailPage').then((module) => ({
    default: module.InventoryItemDetailPage,
  })),
);
const InventoryItemFormPage = lazy(() =>
  import('../features/inventory/InventoryItemFormPage').then((module) => ({
    default: module.InventoryItemFormPage,
  })),
);
const SalesListPage = lazy(() =>
  import('../features/commercial/SalesListPage').then((module) => ({
    default: module.SalesListPage,
  })),
);
const SaleFormPage = lazy(() =>
  import('../features/commercial/SaleFormPage').then((module) => ({
    default: module.SaleFormPage,
  })),
);
const SaleDetailPage = lazy(() =>
  import('../features/commercial/SaleDetailPage').then((module) => ({
    default: module.SaleDetailPage,
  })),
);
const BillingPage = lazy(() =>
  import('../features/commercial/BillingPage').then((module) => ({ default: module.BillingPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('../features/commercial/InvoiceDetailPage').then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);
const CashPage = lazy(() =>
  import('../features/commercial/CashPage').then((module) => ({ default: module.CashPage })),
);
const ChangePasswordPage = lazy(() =>
  import('../features/admin/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const UsersListPage = lazy(() =>
  import('../features/admin/UsersPages').then((module) => ({ default: module.UsersListPage })),
);
const MemberCreatePage = lazy(() =>
  import('../features/admin/UsersPages').then((module) => ({ default: module.MemberCreatePage })),
);
const MemberDetailPage = lazy(() =>
  import('../features/admin/UsersPages').then((module) => ({ default: module.MemberDetailPage })),
);
const SettingsPage = lazy(() =>
  import('../features/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const ReportsPage = lazy(() =>
  import('../features/admin/ReportsPage').then((module) => ({ default: module.ReportsPage })),
);
const PlatformOverviewPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformOverviewPage,
  })),
);
const PlatformOrganizationsPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformOrganizationsPage,
  })),
);
const PlatformOrganizationDetailPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformOrganizationDetailPage,
  })),
);
const PlatformActivityPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformActivityPage,
  })),
);
const PlatformSubscriptionsPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformSubscriptionsPage,
  })),
);
const PlatformAccountsPage = lazy(() =>
  import('../features/platform/PlatformPages').then((module) => ({
    default: module.PlatformAccountsPage,
  })),
);

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      Cargando Easyvet…
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

// Route declarations keep every product area addressable without hiding sections in the DOM.
export function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route
          path="/"
          element={
            <LazyRoute>
              <LandingPage />
            </LazyRoute>
          }
        />
        <Route
          path="firmar/:token"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PublicSignaturePage />
            </Suspense>
          }
        />
        <Route
          path="login"
          element={
            <LazyRoute>
              <LoginPage />
            </LazyRoute>
          }
        />
        <Route
          path="registro"
          element={
            <LazyRoute>
              <RegistrationPage />
            </LazyRoute>
          }
        />
        <Route
          path="configurar-super-admin"
          element={
            <LazyRoute>
              <PlatformAdminBootstrapPage />
            </LazyRoute>
          }
        />
        <Route
          path="verificar-correo"
          element={
            <LazyRoute>
              <VerifyEmailPage />
            </LazyRoute>
          }
        />
        <Route
          path="recuperar-contrasena"
          element={
            <LazyRoute>
              <PasswordResetRequestPage />
            </LazyRoute>
          }
        />
        <Route
          path="restablecer-contrasena"
          element={
            <LazyRoute>
              <PasswordResetPage />
            </LazyRoute>
          }
        />
        <Route element={<AuthBoundary />}>
          <Route element={<PlatformAdminBoundary />}>
            <Route
              path="plataforma"
              element={
                <LazyRoute>
                  <PlatformShell />
                </LazyRoute>
              }
            >
              <Route
                index
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformOverviewPage />
                  </Suspense>
                }
              />
              <Route
                path="clinicas"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformOrganizationsPage />
                  </Suspense>
                }
              />
              <Route
                path="clinicas/:organizationId"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformOrganizationDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="actividad"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformActivityPage />
                  </Suspense>
                }
              />
              <Route
                path="suscripciones"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformSubscriptionsPage />
                  </Suspense>
                }
              />
              <Route
                path="cuentas"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PlatformAccountsPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>
          <Route
            path="cambiar-contrasena"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ChangePasswordPage />
              </Suspense>
            }
          />
          <Route
            path="seleccionar-organizacion"
            element={
              <LazyRoute>
                <OrganizationSelectorPage />
              </LazyRoute>
            }
          />
          <Route path="acceso-denegado" element={<AccessDeniedPage />} />
          <Route
            element={
              <LazyRoute>
                <AppShell />
              </LazyRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="usuarios"
              element={
                <PermissionRoute permission={PERMISSION.MEMBERS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <UsersListPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="usuarios/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.MEMBERS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <MemberCreatePage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="usuarios/:membershipId"
              element={
                <PermissionRoute permission={PERMISSION.MEMBERS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <MemberDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="configuracion"
              element={
                <PermissionRoute permission={PERMISSION.ORGANIZATION_SETTINGS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <SettingsPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="informes"
              element={
                <AnyPermissionRoute
                  permissions={[
                    PERMISSION.REPORTS_OPERATIONAL,
                    PERMISSION.REPORTS_CLINICAL,
                    PERMISSION.REPORTS_COMMERCIAL,
                    PERMISSION.REPORTS_INVENTORY,
                  ]}
                >
                  <Suspense fallback={<RouteFallback />}>
                    <ReportsPage />
                  </Suspense>
                </AnyPermissionRoute>
              }
            />
            <Route
              path="inventario"
              element={
                <PermissionRoute permission={PERMISSION.INVENTORY_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <InventoryPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="inventario/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.INVENTORY_ITEMS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <InventoryItemFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="inventario/:itemId/editar"
              element={
                <PermissionRoute permission={PERMISSION.INVENTORY_ITEMS_UPDATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <InventoryItemFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="inventario/:itemId"
              element={
                <PermissionRoute permission={PERMISSION.INVENTORY_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <InventoryItemDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="ventas"
              element={
                <PermissionRoute permission={PERMISSION.SALES_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <SalesListPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="ventas/nueva"
              element={
                <PermissionRoute permission={PERMISSION.SALES_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <SaleFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="ventas/:saleId/editar"
              element={
                <PermissionRoute permission={PERMISSION.SALES_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <SaleFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="ventas/:saleId"
              element={
                <PermissionRoute permission={PERMISSION.SALES_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <SaleDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="facturacion"
              element={
                <PermissionRoute permission={PERMISSION.BILLING_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <BillingPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="facturacion/:invoiceId"
              element={
                <PermissionRoute permission={PERMISSION.BILLING_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <InvoiceDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="caja"
              element={
                <PermissionRoute permission={PERMISSION.CASH_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <CashPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="peluqueria"
              element={
                <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <GroomingQueuePage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="peluqueria/nueva"
              element={
                <PermissionRoute permission={PERMISSION.GROOMING_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <GroomingFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="peluqueria/:groomingVisitId/editar"
              element={
                <PermissionRoute permission={PERMISSION.GROOMING_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <GroomingFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="peluqueria/:groomingVisitId"
              element={
                <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <GroomingVisitDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="seguimientos"
              element={
                <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <FollowUpsPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="seguimientos/:followUpId"
              element={
                <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <FollowUpDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="seguimientos/:followUpId/editar"
              element={
                <PermissionRoute permission={PERMISSION.FOLLOW_UPS_UPDATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <FollowUpFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/seguimientos/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.FOLLOW_UPS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <FollowUpFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route path="health" element={<HealthPage />} />
            <Route
              path="perfil/profesional"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_RECORDS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <ProfessionalProfilePage />
                  </Suspense>
                </PermissionRoute>
              }
            />
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
              path="agenda/disponibilidad"
              element={
                <PermissionRoute permission={PERMISSION.AVAILABILITY_READ}>
                  <AvailabilityPage />
                </PermissionRoute>
              }
            />
            <Route
              path="agenda/disponibilidad/nueva"
              element={
                <PermissionRoute permission={PERMISSION.AVAILABILITY_READ}>
                  <AvailabilityPage />
                </PermissionRoute>
              }
            />
            <Route
              path="agenda/disponibilidad/:ruleId/editar"
              element={
                <PermissionRoute permission={PERMISSION.AVAILABILITY_READ}>
                  <AvailabilityPage />
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
            <Route
              path="pacientes/:patientId/historia"
              element={
                <AnyPermissionRoute
                  permissions={[
                    PERMISSION.CLINICAL_RECORDS_READ,
                    PERMISSION.CLINICAL_ENCOUNTERS_READ,
                    PERMISSION.CLINICAL_EVOLUTIONS_READ,
                    PERMISSION.PRESCRIPTIONS_READ,
                    PERMISSION.VACCINATIONS_READ,
                    PERMISSION.DEWORMINGS_READ,
                    PERMISSION.PROCEDURES_READ,
                    PERMISSION.ANESTHESIA_READ,
                    PERMISSION.HOSPITALIZATIONS_READ,
                    PERMISSION.DIAGNOSTICS_READ,
                    PERMISSION.DOCUMENTS_READ,
                    PERMISSION.CONSENTS_READ,
                    PERMISSION.FOLLOW_UPS_READ,
                    PERMISSION.GROOMING_READ,
                  ]}
                >
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalHistoryPage />
                  </Suspense>
                </AnyPermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/seguimientos"
              element={
                <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <PatientFollowUpsPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/peluqueria"
              element={
                <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <GroomingHistoryPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/documentos"
              element={
                <PermissionRoute permission={PERMISSION.DOCUMENTS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <DocumentsPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/consentimientos"
              element={
                <PermissionRoute permission={PERMISSION.CONSENTS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <ConsentsPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/consentimientos/:consentId"
              element={
                <PermissionRoute permission={PERMISSION.CONSENTS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <ConsentDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/consentimientos/:consentId/editar"
              element={
                <PermissionRoute permission={PERMISSION.CONSENTS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <ConsentFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/consentimientos/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.CONSENTS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <ConsentFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/procedimientos"
              element={
                <AnyPermissionRoute
                  permissions={[PERMISSION.PROCEDURES_READ, PERMISSION.ANESTHESIA_READ]}
                >
                  <Suspense fallback={<RouteFallback />}>
                    <ProceduresAnesthesiaListPage />
                  </Suspense>
                </AnyPermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/hospitalizaciones"
              element={
                <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <HospitalizationListPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/diagnosticos"
              element={
                <PermissionRoute permission={PERMISSION.DIAGNOSTICS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <DiagnosticOrderListPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
              element={
                <PermissionRoute permission={PERMISSION.DIAGNOSTICS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <DiagnosticOrderDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId/editar"
              element={
                <PermissionRoute permission={PERMISSION.DIAGNOSTICS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <DiagnosticOrderFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/diagnosticos/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.DIAGNOSTICS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <DiagnosticOrderFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId"
              element={
                <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <HospitalizationDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId/editar"
              element={
                <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_UPDATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <HospitalizationFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/hospitalizacion/nueva"
              element={
                <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <HospitalizationFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/procedimientos/:procedureId"
              element={
                <PermissionRoute permission={PERMISSION.PROCEDURES_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <ProcedureDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/procedimientos/nuevo"
              element={
                <PermissionRoute permission={PERMISSION.PROCEDURES_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <ProcedureFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/procedimientos/:procedureId/editar"
              element={
                <PermissionRoute permission={PERMISSION.PROCEDURES_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <ProcedureFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/anestesias/:anesthesiaRecordId"
              element={
                <PermissionRoute permission={PERMISSION.ANESTHESIA_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <AnesthesiaDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/anestesias/nueva"
              element={
                <PermissionRoute permission={PERMISSION.ANESTHESIA_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <AnesthesiaFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/anestesias/:anesthesiaRecordId/editar"
              element={
                <PermissionRoute permission={PERMISSION.ANESTHESIA_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <AnesthesiaFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/prescripciones"
              element={
                <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <PrescriptionListPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/preventivos"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PreventiveCarePage />
                </Suspense>
              }
            />
            <Route
              path="pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId"
              element={
                <PermissionRoute permission={PERMISSION.VACCINATIONS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <VaccinationDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/vacunas/nueva"
              element={
                <PermissionRoute permission={PERMISSION.VACCINATIONS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <VaccinationFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId/editar"
              element={
                <PermissionRoute permission={PERMISSION.VACCINATIONS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <VaccinationFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId"
              element={
                <PermissionRoute permission={PERMISSION.DEWORMINGS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <DewormingDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/desparasitaciones/nueva"
              element={
                <PermissionRoute permission={PERMISSION.DEWORMINGS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <DewormingFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId/editar"
              element={
                <PermissionRoute permission={PERMISSION.DEWORMINGS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <DewormingFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/prescripciones/:prescriptionId"
              element={
                <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <PrescriptionDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/prescripciones/nueva"
              element={
                <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <PrescriptionFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/prescripciones/:prescriptionId/editar"
              element={
                <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <PrescriptionFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/nueva"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalEncounterFormPage mode="create" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_READ}>
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalEncounterDetailPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/editar"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_UPDATE_DRAFT}>
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalEncounterFormPage mode="edit" />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/evoluciones/nueva"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_EVOLUTIONS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalEvolutionFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="pacientes/:patientId/historia/encuentros/:encounterId/evoluciones/nueva"
              element={
                <PermissionRoute permission={PERMISSION.CLINICAL_EVOLUTIONS_CREATE}>
                  <Suspense fallback={<RouteFallback />}>
                    <ClinicalEvolutionFormPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path="*"
              element={
                <LazyRoute>
                  <NotFoundPage />
                </LazyRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </AppErrorBoundary>
  );
}
