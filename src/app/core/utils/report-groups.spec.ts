import type { DogReport } from '../../models/dog-report.model';

import { escapeHtml, groupReportsByDog } from './report-groups';

function makeReport(overrides: Partial<DogReport>): DogReport {
  return {
    id: 'r1',
    user_id: 'u1',
    dog_id: null,
    title: 'Reporte',
    photo_url: '',
    photo_path: null,
    breed: 'Mestizo',
    size: 'mediano',
    description: 'Perrito amigable',
    situation: null,
    found_at: '2026-01-01T10:00:00.000Z',
    urgency_level: 'normal',
    urgency_category: null,
    latitude: 4.7,
    longitude: -74.1,
    zone: 'Cálamo',
    weather_code: null,
    weather_description: null,
    weather_emoji: null,
    temperature: null,
    humidity: null,
    precipitation: null,
    wind_speed: null,
    report_status: 'activo',
    created_at: '2026-01-01T11:00:00.000Z',
    updated_at: '2026-01-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('groupReportsByDog', () => {
  it('agrupa todas las publicaciones posteriores dentro de la alerta original mediante parent_report_id', () => {
    const groups = groupReportsByDog([
      makeReport({ id: 'ALERT-001', dog_id: 'dog-1', title: 'Alerta original', found_at: '2026-01-01T10:00:00.000Z' }),
      makeReport({
        id: 'REP-002',
        dog_id: 'dog-1',
        parent_report_id: 'ALERT-001',
        title: 'Actualización 1',
        found_at: '2026-01-02T10:00:00.000Z',
      }),
      makeReport({
        id: 'REP-003',
        dog_id: 'dog-1',
        parent_report_id: 'ALERT-001',
        title: 'Actualización 2',
        found_at: '2026-01-03T10:00:00.000Z',
      }),
      makeReport({
        id: 'ALERT-002',
        dog_id: 'dog-2',
        title: 'Otra alerta distinta',
        found_at: '2026-01-04T10:00:00.000Z',
      }),
    ]);

    expect(groups).toHaveLength(2);
    // La alerta original ALERT-001 agrupa a sus 3 publicaciones y NO crea marcadores extra
    const alert1 = groups.find((g) => g.alertId === 'ALERT-001');
    expect(alert1).toBeDefined();
    expect(alert1?.reports).toHaveLength(3);
    expect(alert1?.reports.map((r) => r.id)).toEqual(['ALERT-001', 'REP-002', 'REP-003']);
    expect(alert1?.initial.title).toBe('Alerta original');
  });

  it('ancla la alerta original aunque el seguimiento apunte a una actualización intermedia', () => {
    const groups = groupReportsByDog([
      makeReport({ id: 'ALERT', dog_id: 'dog-1', title: 'Alerta original', found_at: '2026-01-01T10:00:00.000Z' }),
      makeReport({
        id: 'MID',
        dog_id: 'dog-1',
        parent_report_id: 'ALERT',
        title: 'Actualización 1',
        found_at: '2026-01-02T10:00:00.000Z',
      }),
      makeReport({
        id: 'LATEST',
        dog_id: 'dog-1',
        parent_report_id: 'MID',
        title: 'Actualización 2',
        found_at: '2026-01-03T10:00:00.000Z',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].alertId).toBe('ALERT');
    expect(groups[0].reports.map((r) => r.id)).toEqual(['ALERT', 'MID', 'LATEST']);
  });

  it('sin parent_report_id agrupa por dog_id usando la publicación más antigua como alerta original', () => {
    const groups = groupReportsByDog([
      makeReport({ id: 'REP-NEW', dog_id: 'dog-1', title: 'Seguimiento', found_at: '2026-01-03T10:00:00.000Z' }),
      makeReport({ id: 'REP-OLD', dog_id: 'dog-1', title: 'Alerta original', found_at: '2026-01-01T10:00:00.000Z' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].alertId).toBe('REP-OLD');
    expect(groups[0].reports.map((r) => r.id)).toEqual(['REP-OLD', 'REP-NEW']);
  });

  it('conserva el título y la descripción propios de cada publicación al agrupar', () => {
    const groups = groupReportsByDog([
      makeReport({
        id: 'A',
        dog_id: 'zeus',
        title: 'Zeus está gordo',
        description: 'Necesita controlar su peso',
        found_at: '2026-01-01T10:00:00.000Z',
      }),
      makeReport({
        id: 'B',
        dog_id: 'zeus',
        parent_report_id: 'A',
        title: 'Zeus ya está mejor',
        description: 'Ha regulado su peso corporal',
        found_at: '2026-01-02T10:00:00.000Z',
      }),
      makeReport({
        id: 'C',
        dog_id: 'zeus',
        parent_report_id: 'B',
        title: 'Zeus necesita seguimiento',
        description: 'Revisar su alimentación',
        found_at: '2026-01-03T10:00:00.000Z',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].initial.title).toBe('Zeus está gordo');
    expect(groups[0].reports.map((r) => [r.title, r.description])).toEqual([
      ['Zeus está gordo', 'Necesita controlar su peso'],
      ['Zeus ya está mejor', 'Ha regulado su peso corporal'],
      ['Zeus necesita seguimiento', 'Revisar su alimentación'],
    ]);
  });

  it('no agrupa perros distintos con alertas independientes aunque estén en el mismo lugar', () => {
    const groups = groupReportsByDog([
      makeReport({ id: 'a', dog_id: 'dog-a', latitude: 4.7, longitude: -74.1 }),
      makeReport({ id: 'b', dog_id: 'dog-b', latitude: 4.7, longitude: -74.1 }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('mantiene cada reporte sin perro asignado como marcador independiente', () => {
    const groups = groupReportsByDog([
      makeReport({ id: 'a', dog_id: null }),
      makeReport({ id: 'b', dog_id: null, latitude: 4.7, longitude: -74.1 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.dogId === null)).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('escapa texto usado en el popup del mapa', () => {
    expect(escapeHtml('<img src="x" onerror=\'y\'>&')).toBe('&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt;&amp;');
  });
});
