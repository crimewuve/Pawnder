export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toLocalIso(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}


export function toLocalInput(date: Date): string {
  return toLocalIso(date).slice(0, 16);
}
