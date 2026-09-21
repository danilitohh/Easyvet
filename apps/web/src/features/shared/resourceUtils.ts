import { ApiError } from '../../services/apiClient';

// Translate public API statuses into short, user-safe messages without exposing SQL or tenant data.
export function errorMessage(error: unknown, fallback = 'No fue posible completar la solicitud.') {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'OWNER_HAS_ACTIVE_PATIENTS') {
    return 'No puedes archivar este propietario mientras tenga pacientes activos vinculados.';
  }
  if (error.code === 'RESOURCE_ARCHIVED') {
    return 'Este registro está archivado y no puede editarse hasta definir una restauración.';
  }
  if (error.code === 'RESOURCE_CONFLICT') {
    return 'Ya existe un propietario con ese documento en esta veterinaria.';
  }
  if (error.code === 'APPOINTMENT_CONFLICT' || error.code === 'OWNER_PATIENT_MISMATCH') {
    return 'El horario ya no está disponible. Selecciona otro horario.';
  }
  if (error.code === 'INVALID_APPOINTMENT_STATE') {
    return 'La cita ya no permite esta operación por su estado actual.';
  }
  if (error.code === 'CURRENT_WEIGHT_MANAGED_BY_CLINICAL_RECORD') {
    return 'El peso actual se actualiza desde la historia clínica.';
  }
  if (error.code === 'CLINICAL_ENCOUNTER_STALE') {
    return 'Esta consulta fue modificada desde otra sesión. Recarga la versión actual.';
  }
  if (error.code === 'CLINICAL_ENCOUNTER_IMMUTABLE') {
    return 'La consulta ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'INVALID_CLINICAL_ENCOUNTER_STATE') {
    return 'La consulta no permite esta operación en su estado actual.';
  }
  if (error.code === 'PROFESSIONAL_PROFILE_REQUIRED') {
    return 'Completa tu perfil profesional antes de finalizar esta consulta.';
  }
  if (error.code === 'ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE') {
    return 'Esta consulta debe ser finalizada por el Practitioner responsable.';
  }
  if (error.status === 409) return 'No se pudo completar la operación porque existe un conflicto.';
  if (error.code === 'RESOURCE_NOT_FOUND' || error.status === 404) {
    return 'No encontramos este recurso.';
  }
  if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.';
  if (error.status === 403) return 'No tienes permisos para realizar esta acción.';
  if (error.status === 400 || error.status === 422) {
    return typeof error.message === 'string' ? error.message : 'Revisa los datos ingresados.';
  }
  if (error.status >= 500) return 'El servicio no está disponible. Intenta nuevamente.';
  return error.message;
}
