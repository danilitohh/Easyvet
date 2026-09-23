import { lazy, Suspense } from 'react';
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
import { AnyPermissionRoute, PermissionRoute } from '../features/shared/ResourceFeedback';
import { OwnerListPage } from '../features/owners/OwnerListPage';
import { OwnerDetailPage } from '../features/owners/OwnerDetailPage';
import { OwnerFormPage } from '../features/owners/OwnerFormPage';
import { PatientListPage } from '../features/patients/PatientListPage';
import { PatientDetailPage } from '../features/patients/PatientDetailPage';
import { PatientFormPage } from '../features/patients/PatientFormPage';
import { AgendaPage } from '../features/agenda/AgendaPage';
import { AppointmentFormPage } from '../features/agenda/AppointmentFormPage';
import { AvailabilityPage } from '../features/agenda/AvailabilityPage';

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

function ClinicalRouteFallback() {
  return (
    <div className="loading-state" role="status">
      Cargando historia clínica
    </div>
  );
}

// Route declarations keep every product area addressable without hiding sections in the DOM.
export function App() {
  return (
    <Routes>
      <Route
        path="firmar/:token"
        element={
          <Suspense fallback={<ClinicalRouteFallback />}>
            <PublicSignaturePage />
          </Suspense>
        }
      />
      <Route path="login" element={<LoginPage />} />
      <Route element={<AuthBoundary />}>
        <Route path="seleccionar-organizacion" element={<OrganizationSelectorPage />} />
        <Route path="acceso-denegado" element={<AccessDeniedPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="inventario"
            element={
              <PermissionRoute permission={PERMISSION.INVENTORY_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <InventoryPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="inventario/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.INVENTORY_ITEMS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <InventoryItemFormPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="inventario/:itemId/editar"
            element={
              <PermissionRoute permission={PERMISSION.INVENTORY_ITEMS_UPDATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <InventoryItemFormPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="inventario/:itemId"
            element={
              <PermissionRoute permission={PERMISSION.INVENTORY_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <InventoryItemDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="peluqueria"
            element={
              <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <GroomingQueuePage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="peluqueria/nueva"
            element={
              <PermissionRoute permission={PERMISSION.GROOMING_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <GroomingFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="peluqueria/:groomingVisitId/editar"
            element={
              <PermissionRoute permission={PERMISSION.GROOMING_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <GroomingFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="peluqueria/:groomingVisitId"
            element={
              <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <GroomingVisitDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="seguimientos"
            element={
              <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <FollowUpsPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="seguimientos/:followUpId"
            element={
              <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <FollowUpDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="seguimientos/:followUpId/editar"
            element={
              <PermissionRoute permission={PERMISSION.FOLLOW_UPS_UPDATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <FollowUpFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/seguimientos/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.FOLLOW_UPS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
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
                <Suspense fallback={<ClinicalRouteFallback />}>
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
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalHistoryPage />
                </Suspense>
              </AnyPermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/seguimientos"
            element={
              <PermissionRoute permission={PERMISSION.FOLLOW_UPS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <PatientFollowUpsPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/peluqueria"
            element={
              <PermissionRoute permission={PERMISSION.GROOMING_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <GroomingHistoryPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/documentos"
            element={
              <PermissionRoute permission={PERMISSION.DOCUMENTS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DocumentsPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/consentimientos"
            element={
              <PermissionRoute permission={PERMISSION.CONSENTS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ConsentsPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/consentimientos/:consentId"
            element={
              <PermissionRoute permission={PERMISSION.CONSENTS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ConsentDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/consentimientos/:consentId/editar"
            element={
              <PermissionRoute permission={PERMISSION.CONSENTS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ConsentFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/consentimientos/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.CONSENTS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
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
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ProceduresAnesthesiaListPage />
                </Suspense>
              </AnyPermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/hospitalizaciones"
            element={
              <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <HospitalizationListPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/diagnosticos"
            element={
              <PermissionRoute permission={PERMISSION.DIAGNOSTICS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DiagnosticOrderListPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
            element={
              <PermissionRoute permission={PERMISSION.DIAGNOSTICS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DiagnosticOrderDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId/editar"
            element={
              <PermissionRoute permission={PERMISSION.DIAGNOSTICS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DiagnosticOrderFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/diagnosticos/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.DIAGNOSTICS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DiagnosticOrderFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId"
            element={
              <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <HospitalizationDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId/editar"
            element={
              <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_UPDATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <HospitalizationFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/hospitalizacion/nueva"
            element={
              <PermissionRoute permission={PERMISSION.HOSPITALIZATIONS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <HospitalizationFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/procedimientos/:procedureId"
            element={
              <PermissionRoute permission={PERMISSION.PROCEDURES_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ProcedureDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/procedimientos/nuevo"
            element={
              <PermissionRoute permission={PERMISSION.PROCEDURES_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ProcedureFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/procedimientos/:procedureId/editar"
            element={
              <PermissionRoute permission={PERMISSION.PROCEDURES_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ProcedureFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/anestesias/:anesthesiaRecordId"
            element={
              <PermissionRoute permission={PERMISSION.ANESTHESIA_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <AnesthesiaDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/anestesias/nueva"
            element={
              <PermissionRoute permission={PERMISSION.ANESTHESIA_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <AnesthesiaFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/anestesias/:anesthesiaRecordId/editar"
            element={
              <PermissionRoute permission={PERMISSION.ANESTHESIA_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <AnesthesiaFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/prescripciones"
            element={
              <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <PrescriptionListPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/preventivos"
            element={
              <Suspense fallback={<ClinicalRouteFallback />}>
                <PreventiveCarePage />
              </Suspense>
            }
          />
          <Route
            path="pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId"
            element={
              <PermissionRoute permission={PERMISSION.VACCINATIONS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <VaccinationDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/vacunas/nueva"
            element={
              <PermissionRoute permission={PERMISSION.VACCINATIONS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <VaccinationFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId/editar"
            element={
              <PermissionRoute permission={PERMISSION.VACCINATIONS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <VaccinationFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId"
            element={
              <PermissionRoute permission={PERMISSION.DEWORMINGS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DewormingDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/desparasitaciones/nueva"
            element={
              <PermissionRoute permission={PERMISSION.DEWORMINGS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DewormingFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId/editar"
            element={
              <PermissionRoute permission={PERMISSION.DEWORMINGS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <DewormingFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/prescripciones/:prescriptionId"
            element={
              <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <PrescriptionDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/prescripciones/nueva"
            element={
              <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <PrescriptionFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/prescripciones/:prescriptionId/editar"
            element={
              <PermissionRoute permission={PERMISSION.PRESCRIPTIONS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <PrescriptionFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/nueva"
            element={
              <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalEncounterFormPage mode="create" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId"
            element={
              <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_READ}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalEncounterDetailPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/editar"
            element={
              <PermissionRoute permission={PERMISSION.CLINICAL_ENCOUNTERS_UPDATE_DRAFT}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalEncounterFormPage mode="edit" />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/evoluciones/nueva"
            element={
              <PermissionRoute permission={PERMISSION.CLINICAL_EVOLUTIONS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalEvolutionFormPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          <Route
            path="pacientes/:patientId/historia/encuentros/:encounterId/evoluciones/nueva"
            element={
              <PermissionRoute permission={PERMISSION.CLINICAL_EVOLUTIONS_CREATE}>
                <Suspense fallback={<ClinicalRouteFallback />}>
                  <ClinicalEvolutionFormPage />
                </Suspense>
              </PermissionRoute>
            }
          />
          {MODULE_ROUTES.filter(
            (route) =>
              route.path !== '/dashboard' &&
              route.path !== '/agenda' &&
              route.path !== '/agenda/disponibilidad' &&
              route.path !== '/propietarios' &&
              route.path !== '/pacientes' &&
              route.path !== '/peluqueria' &&
              route.path !== '/inventario',
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
