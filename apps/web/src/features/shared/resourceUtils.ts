import { ApiError } from '../../services/apiClient';

// Translate public API statuses into short, user-safe messages without exposing SQL or tenant data.
export function errorMessage(error: unknown, fallback = 'No fue posible completar la solicitud.') {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'RESOURCE_CONFLICT' || error.status === 409) {
    return 'Ya existe un propietario con ese documento en esta veterinaria.';
  }
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
