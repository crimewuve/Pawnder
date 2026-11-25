import { HttpErrorResponse } from '@angular/common/http';

export function describeHttpError(error: unknown, service: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return `Sin conexión: no se pudo contactar con ${service}. Revisa tu internet.`;
    }
    if (error.status === 429) {
      return `${service} recibió demasiadas consultas. Intenta de nuevo en unos segundos.`;
    }
    if (error.status >= 500) {
      return `${service} no está disponible en este momento.`;
    }
    return `${service} respondió con un error (código ${error.status}).`;
  }
  return `Ocurrió un error inesperado al consultar ${service}.`;
}