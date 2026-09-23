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
  if (error.code === 'INVENTORY_SKU_EXISTS') {
    return 'Ya existe un artículo con ese SKU en esta veterinaria.';
  }
  if (error.code === 'INVENTORY_ITEM_ARCHIVED') {
    return 'El artículo está archivado y no admite nuevos movimientos.';
  }
  if (error.code === 'INVENTORY_ITEM_HAS_STOCK') {
    return 'Reduce las existencias a cero en todas las sedes antes de archivar el artículo.';
  }
  if (error.code === 'INVENTORY_BATCH_REQUIRED') {
    return 'Selecciona un lote para registrar el movimiento de este artículo.';
  }
  if (error.code === 'INVENTORY_BATCH_NOT_ALLOWED') {
    return 'Este artículo no usa lotes; quita la selección de lote.';
  }
  if (error.code === 'INVENTORY_BATCH_NOT_FOUND') {
    return 'El lote seleccionado ya no está disponible. Actualiza el artículo.';
  }
  if (error.code === 'INVALID_INVENTORY_QUANTITY') {
    return 'Ingresa una cantidad positiva con hasta seis decimales.';
  }
  if (error.code === 'INSUFFICIENT_STOCK') {
    return 'El stock disponible cambió. Actualiza el inventario e intenta nuevamente.';
  }
  if (error.code === 'INVALID_INVENTORY_LOCATION') {
    return 'La sede ya no está activa para nuevos movimientos.';
  }
  if (error.code === 'INVALID_INVENTORY_TRANSFER') {
    return 'Selecciona dos sedes activas y distintas para el traslado.';
  }
  if (error.code === 'CLINICAL_ENCOUNTER_STALE') {
    return 'Esta consulta fue modificada desde otra sesión. Recarga la versión actual.';
  }
  if (error.code === 'CLINICAL_ENCOUNTER_IMMUTABLE') {
    return 'La consulta ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'PROCEDURE_STALE') {
    return 'Este procedimiento cambió en otra sesión. Recarga la versión actual antes de guardar.';
  }
  if (error.code === 'PROCEDURE_IMMUTABLE') {
    return 'El procedimiento ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'ANESTHESIA_STALE') {
    return 'Este registro anestésico cambió en otra sesión. Recarga la versión actual antes de guardar.';
  }
  if (error.code === 'ANESTHESIA_IMMUTABLE') {
    return 'El registro anestésico ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'ANESTHESIA_OBSERVATION_EMPTY') {
    return 'Añade al menos un valor clínico, plano anestésico o nota además de la hora.';
  }
  if (error.code === 'PARENT_CLINICAL_PROCEDURE_VOIDED') {
    return 'El procedimiento asociado fue anulado. Cambia o limpia el vínculo antes de continuar.';
  }
  if (error.code === 'ASSISTANT_PROFILE_REQUIRED') {
    return 'El asistente asignado debe tener un perfil profesional para finalizar la cirugía.';
  }
  if (error.code === 'PROCEDURE_NAME_REQUIRED') {
    return 'Completa el nombre del procedimiento antes de finalizar.';
  }
  if (error.code === 'PROCEDURE_PERFORMED_AT_REQUIRED') {
    return 'Registra la fecha y hora de realización antes de finalizar.';
  }
  if (error.code === 'ANESTHESIA_STARTED_AT_REQUIRED') {
    return 'Registra la fecha y hora de inicio antes de finalizar la anestesia.';
  }
  if (error.code === 'INVALID_CLINICAL_ENCOUNTER_STATE') {
    return 'La consulta no permite esta operación en su estado actual.';
  }
  if (error.code === 'PROFESSIONAL_PROFILE_REQUIRED') {
    return 'Completa tu perfil profesional antes de finalizar este registro.';
  }
  if (error.code === 'ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE') {
    return 'Esta operación debe realizarla el profesional responsable.';
  }
  if (error.code === 'PRESCRIPTION_STALE') {
    return 'Esta prescripción fue modificada desde otra sesión. Recarga la versión actual.';
  }
  if (error.code === 'VACCINATION_STALE' || error.code === 'DEWORMING_STALE') {
    return 'Este registro fue modificado desde otra sesión. Recarga la versión actual.';
  }
  if (error.code === 'VACCINATION_IMMUTABLE' || error.code === 'DEWORMING_IMMUTABLE') {
    return 'El registro ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'INVALID_VACCINATION_STATE' || error.code === 'INVALID_DEWORMING_STATE') {
    return 'El registro preventivo no permite esta operación en su estado actual.';
  }
  if (error.code === 'VACCINE_REQUIRED' || error.code === 'VACCINE_NAME_REQUIRED') {
    return 'Completa el nombre de la vacuna antes de finalizar.';
  }
  if (error.code === 'DEWORMING_PRODUCT_REQUIRED') {
    return 'Completa el nombre del producto antes de finalizar.';
  }
  if (error.code === 'RESPONSIBLE_PRACTITIONER_REQUIRED') {
    return 'Selecciona un Practitioner responsable antes de finalizar.';
  }
  if (error.code === 'ADMINISTERED_BY_PROFILE_REQUIRED') {
    return 'El miembro registrado como administrador debe completar su perfil profesional.';
  }
  if (error.code === 'ADMINISTERED_BY_INVALID') {
    return 'Selecciona un miembro clínico activo para «administrado por».';
  }
  if (error.code === 'PATIENT_ARCHIVED') {
    return 'El paciente está archivado y no admite nueva actividad clínica.';
  }
  if (error.code === 'INVALID_NEXT_DUE_DATE') {
    return 'La próxima fecha debe ser igual o posterior a la fecha de aplicación.';
  }
  if (error.code === 'PRESCRIPTION_IMMUTABLE') {
    return 'La prescripción ya no está en borrador y no puede editarse.';
  }
  if (error.code === 'INVALID_PRESCRIPTION_STATE') {
    return 'La prescripción no permite esta operación en su estado actual.';
  }
  if (error.code === 'PRESCRIPTION_ITEMS_REQUIRED') {
    return 'Agrega al menos un medicamento antes de finalizar la prescripción.';
  }
  if (error.code === 'PRESCRIBER_REQUIRED') {
    return 'Selecciona un profesional prescriptor antes de finalizar.';
  }
  if (error.code === 'PRESCRIBER_PROFILE_REQUIRED') {
    return 'Completa el perfil profesional del prescriptor antes de finalizar.';
  }
  if (error.code === 'ONLY_PRESCRIBER_CAN_FINALIZE') {
    return 'Esta prescripción debe ser finalizada por el profesional asignado.';
  }
  if (error.code === 'PARENT_CLINICAL_ENCOUNTER_VOIDED') {
    return 'La consulta asociada fue anulada y este registro ya no puede modificarse.';
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
