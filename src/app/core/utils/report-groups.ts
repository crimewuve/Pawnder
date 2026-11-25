import type { DogReport } from '../../models/dog-report.model';

export interface ReportGroup {
  key: string;
  dogId: string | null;
  /** Identificador de la alerta original o reporte raíz */
  alertId: string;
  reports: DogReport[];
  /** Reporte más reciente en el tiempo */
  latest: DogReport;
  /** Reporte original o primero en el tiempo (la alerta original) */
  initial: DogReport;
}

function timeOf(report: DogReport): number {
  const time = new Date(report.found_at || report.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Agrupa publicaciones en torno a su ALERTA ORIGINAL.
 * 1. Cada alerta inicial (raíz) define una única card/marcador en el mapa.
 * 2. Las publicaciones posteriores que se crean como seguimiento (con parent_report_id)
 *    se integran directamente en el historial de esa alerta original, NUNCA crean una alerta nueva.
 * 3. Si la base todavía no tiene parent_report_id (migración 20261125 pendiente),
 *    se conserva el agrupamiento histórico por dog_id: la publicación más antigua
 *    de ese perro actúa como alerta original y las demás se muestran en su historial.
 */
export function groupReportsByDog(reports: DogReport[]): ReportGroup[] {
  // Mapa de alertKey -> lista de publicaciones de esa alerta
  const grouped = new Map<string, DogReport[]>();

  // 1. Mapear rápidamente todos los reportes por su ID
  const reportById = new Map<string, DogReport>();
  for (const r of reports) {
    reportById.set(r.id, r);
  }

  // 2. Función auxiliar para encontrar el reporte raíz de cualquier reporte
  const findRootId = (report: DogReport): string => {
    let current = report;
    const visited = new Set<string>([current.id]);
    while (current.parent_report_id && reportById.has(current.parent_report_id)) {
      const parent = reportById.get(current.parent_report_id)!;
      if (visited.has(parent.id)) break; // Evitar ciclos
      visited.add(parent.id);
      current = parent;
    }
    return current.id;
  };

  // 3. Respaldo por dog_id: publicación más antigua de cada perro.
  //    Se usa cuando no hay padre y también para anclar la raíz de un padre intermedio.
  const earliestByDog = new Map<string, DogReport>();
  for (const report of reports) {
    if (!report.dog_id) continue;
    const current = earliestByDog.get(report.dog_id);
    if (!current || timeOf(report) < timeOf(current)) {
      earliestByDog.set(report.dog_id, report);
    }
  }

  // 4. Agrupar cada reporte bajo su alerta original. Si la raíz del padre
  //    pertenece a un perro conocido, la publicación más antigua de ese perro
  //    sigue siendo la alerta original.
  for (const report of reports) {
    const parentRoot = reportById.get(findRootId(report)) ?? report;
    const rootId = parentRoot.dog_id ? (earliestByDog.get(parentRoot.dog_id)?.id ?? parentRoot.id) : parentRoot.id;
    const key = `alert:${rootId}`;

    const current = grouped.get(key);
    if (current) {
      current.push(report);
    } else {
      grouped.set(key, [report]);
    }
  }

  return [...grouped.entries()]
    .map(([key, list]) => {
      // Orden cronológico: el reporte original primero, seguido de las actualizaciones
      const chronologicallyAsc = [...list].sort((a, b) => timeOf(a) - timeOf(b));
      const initial = chronologicallyAsc[0];
      const latest = chronologicallyAsc[chronologicallyAsc.length - 1];

      return {
        key,
        alertId: initial.id,
        dogId: initial.dog_id ?? latest.dog_id ?? null,
        reports: chronologicallyAsc,
        initial,
        latest,
      };
    })
    .sort((a, b) => timeOf(b.latest) - timeOf(a.latest));
}

/** Los popups del mapa se construyen como HTML; escapa todo texto del usuario. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
