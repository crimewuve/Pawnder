import type { DogReport } from '../../models/dog-report.model';

export interface ReportGroup {
  key: string;
  dogId: string | null;
  
  alertId: string;
  reports: DogReport[];
  
  latest: DogReport;
  
  initial: DogReport;
}

function timeOf(report: DogReport): number {
  const time = new Date(report.found_at || report.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}


export function groupReportsByDog(reports: DogReport[]): ReportGroup[] {
  
  const grouped = new Map<string, DogReport[]>();

  
  const reportById = new Map<string, DogReport>();
  for (const r of reports) {
    reportById.set(r.id, r);
  }

  
  const findRootId = (report: DogReport): string => {
    let current = report;
    const visited = new Set<string>([current.id]);
    while (current.parent_report_id && reportById.has(current.parent_report_id)) {
      const parent = reportById.get(current.parent_report_id)!;
      if (visited.has(parent.id)) break; 
      visited.add(parent.id);
      current = parent;
    }
    return current.id;
  };

  
  
  const earliestByDog = new Map<string, DogReport>();
  for (const report of reports) {
    if (!report.dog_id) continue;
    const current = earliestByDog.get(report.dog_id);
    if (!current || timeOf(report) < timeOf(current)) {
      earliestByDog.set(report.dog_id, report);
    }
  }

  
  
  
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

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
