import type { GroomingVisitStatus } from '@veterinary-saas/contracts';
import { ApiError } from '../../services/apiClient';

export const GROOMING_MUTATED_EVENT = 'easyvet:grooming-mutated';

// Mutations refresh queues and Patient history without coupling the separate pages.
export function notifyGroomingMutation(): void {
  window.dispatchEvent(new Event(GROOMING_MUTATED_EVENT));
}

export const GROOMING_STATUS_LABEL: Record<GroomingVisitStatus, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En atención',
  COMPLETED: 'Completada',
  VOIDED: 'Anulada',
};

export function groomingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const translations: Record<string, string> = {
    STALE_GROOMING_VISIT:
      'El registro cambió en otra sesión. Recarga la versión más reciente antes de continuar.',
    PATIENT_ARCHIVED:
      'El paciente está archivado; solo puedes consultar o anular registros existentes.',
    ACTIVE_GROOMING_VISIT_EXISTS:
      'El paciente no se puede archivar mientras tenga una atención de peluquería activa.',
    APPOINTMENT_NOT_ELIGIBLE:
      'La cita está cancelada o marcada como no asistió. Desvincúlala o elige otra cita.',
    APPOINTMENT_ALREADY_HAS_GROOMING_VISIT:
      'Esta cita ya está vinculada a otra atención de peluquería.',
    GROOMER_REQUIRED: 'Asigna un peluquero activo antes de iniciar la atención.',
    GROOMING_SERVICE_REQUIRED: 'Describe el servicio antes de iniciar la atención.',
    GROOMER_NOT_ELIGIBLE:
      'El peluquero asignado ya no tiene permisos activos para realizar el servicio.',
    CLINIC_LOCATION_INACTIVE: 'La sede seleccionada ya no está activa.',
  };
  return (error.code && translations[error.code]) || error.message || fallback;
}

export function ownerLabel(visit: { ownerAtTime: { displayName: string } }): string {
  return visit.ownerAtTime.displayName;
}
