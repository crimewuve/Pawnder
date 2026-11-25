import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  DogIdentity,
  DogReport,
  NewDogIdentity,
  NewDogReport,
  ReportFilters,
  ReportPatch,
  ReportPhoto,
  ReportStatus,
} from '../../models/dog-report.model';

import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

// `*` ya incluye parent_report_id cuando la migración 20261125 está aplicada.
// No se pide de forma explícita para que la consulta no falle en bases donde
// todavía no se ejecutó esa migración.
const SELECT =
  '*, profiles(display_name, avatar_url), dogs(id, name, breed, size, photo_url, created_at), dog_report_photos(id, report_id, photo_url, photo_path, position, is_primary), report_comments(count)';

const FALLBACK_SELECT = '*';

// Errores de esquema/relaciones opcionales: si el historial, las fotos o una
// columna nueva no existen todavía, las alertas principales deben cargar igual.
const OPTIONAL_SCHEMA_CODES = new Set(['42703', '42P01', 'PGRST200', 'PGRST204', 'PGRST205']);

interface LegacyReportRow {
  id: string;
  dog_id: string | null;
  parent_report_id?: string | null;
  title: string;
  breed: string;
  size: DogReport['size'];
  photo_url: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);

  async list(filters?: Partial<ReportFilters>): Promise<DogReport[]> {
    const run = (select: string) => {
      let query = this.supabase.from('dog_reports').select(select);
      if (filters?.urgency && filters.urgency !== 'todas') {
        query = query.eq('urgency_level', filters.urgency);
      }
      if (filters?.zone?.trim()) {
        query = query.ilike('zone', `%${filters.zone.trim()}%`);
      }
      if (filters?.breed?.trim()) {
        query = query.ilike('breed', `%${filters.breed.trim()}%`);
      }
      return query.order('created_at', { ascending: filters?.order === 'antiguos' });
    };

    let { data, error } = await run(SELECT);
    if (error && this.isOptionalSchemaError(error)) {
      console.warn('[ReportsService.list] Relaciones opcionales no disponibles, cargando alertas base:', error.message);
      ({ data, error } = await run(FALLBACK_SELECT));
    }
    if (error) throw new Error(this.msg(error.message));
    return this.withPhotos((data ?? []) as unknown as DogReport[]);
  }

  async listMine(userId: string): Promise<DogReport[]> {
    const run = (select: string) =>
      this.supabase.from('dog_reports').select(select).eq('user_id', userId).order('created_at', { ascending: false });

    let { data, error } = await run(SELECT);
    if (error && this.isOptionalSchemaError(error)) {
      console.warn(
        '[ReportsService.listMine] Relaciones opcionales no disponibles, cargando alertas base:',
        error.message,
      );
      ({ data, error } = await run(FALLBACK_SELECT));
    }
    if (error) throw new Error(this.msg(error.message));
    return this.withPhotos((data ?? []) as unknown as DogReport[]);
  }

  async getById(id: string): Promise<DogReport> {
    let { data, error } = await this.supabase.from('dog_reports').select(SELECT).eq('id', id).single();
    if (error && this.isOptionalSchemaError(error)) {
      console.warn(
        '[ReportsService.getById] Relaciones opcionales no disponibles, cargando alerta base:',
        error.message,
      );
      ({ data, error } = await this.supabase.from('dog_reports').select(FALLBACK_SELECT).eq('id', id).single());
    }
    if (error) throw new Error(this.msg(error.message));
    return this.withPhotos([data as unknown as DogReport])[0];
  }

  async create(input: NewDogReport, userId: string): Promise<DogReport> {
    const { parent_report_id, ...baseInput } = input;
    // Si no hay alerta padre, se omite la columna: así funciona incluso antes
    // de aplicar la migración 20261125_parent_report_id.
    const payload = parent_report_id ? { ...baseInput, parent_report_id } : baseInput;

    // Se devuelve la fila base: evitar relaciones opcionales aquí impide que un
    // fallo de lectura de fotos/comentarios convierta una publicación exitosa en error.
    let { data, error } = await this.supabase
      .from('dog_reports')
      .insert({ ...payload, user_id: userId })
      .select(FALLBACK_SELECT)
      .single();

    if (error && parent_report_id && error.code === '42703' && /parent_report_id/i.test(error.message)) {
      console.warn('[ReportsService.create] parent_report_id no existe todavía; se guarda sin vínculo explícito.');
      ({ data, error } = await this.supabase
        .from('dog_reports')
        .insert({ ...baseInput, user_id: userId })
        .select(FALLBACK_SELECT)
        .single());
    }
    if (error) throw new Error(this.msg(error.message));
    return this.withPhotos([data as unknown as DogReport])[0];
  }

  /**
   * Busca todos los perros registrados en Pawnder (desde la tabla `dogs` y desde `dog_reports` antiguos).
   * No limita arbitrariamente a publicaciones recientes ni se restringe al usuario actual.
   * Evita duplicados y permite relacionar cualquier reporte nuevo con perros antiguos.
   */
  async searchDogs(query: string): Promise<DogIdentity[]> {
    const term = query.trim().toLowerCase();

    // 1. Consultar perros explícitos registrados en la tabla `dogs` (sin límite restrictivo)
    let dogsQuery = this.supabase
      .from('dogs')
      .select('id, name, breed, size, photo_url, created_at')
      .order('created_at', { ascending: false });

    if (term) {
      dogsQuery = dogsQuery.or(`name.ilike.%${term}%,breed.ilike.%${term}%`);
    }

    const { data: explicitDogs, error: dogsError } = await dogsQuery;
    if (dogsError) throw new Error(this.msg(dogsError.message));

    const resultsMap = new Map<string, DogIdentity>();

    for (const d of (explicitDogs ?? []) as DogIdentity[]) {
      if (d && d.id) {
        resultsMap.set(d.id, d);
      }
    }

    // 2. Consultar reportes históricos (dog_reports) para recuperar perros y alertas de publicaciones anteriores
    const runLegacy = (select: string) => {
      let query = this.supabase.from('dog_reports').select(select).order('created_at', { ascending: false });
      if (term) {
        query = query.or(`title.ilike.%${term}%,breed.ilike.%${term}%`);
      }
      return query;
    };

    let { data: legacyReports, error: repError } = await runLegacy(
      'id, dog_id, parent_report_id, title, breed, size, photo_url, created_at',
    );
    if (repError && this.isOptionalSchemaError(repError)) {
      // Antes de aplicar la migración parent_report_id, el historial se apoya en dog_id.
      ({ data: legacyReports, error: repError } = await runLegacy(
        'id, dog_id, title, breed, size, photo_url, created_at',
      ));
    }
    if (!repError && legacyReports) {
      const rows = legacyReports as unknown as LegacyReportRow[];
      for (const r of rows) {
        // La alerta raíz es r.parent_report_id si existe, o r.id si es la publicación inicial
        const rootAlertId = r.parent_report_id || r.id;

        // Si el perro ya estaba en resultsMap, aseguramos que tenga origin_report_id de la alerta inicial
        if (r.dog_id && resultsMap.has(r.dog_id)) {
          const current = resultsMap.get(r.dog_id);
          if (current && !current.origin_report_id) {
            current.origin_report_id = rootAlertId;
          }
          continue;
        }

        const candidateId = r.dog_id || r.id;
        if (!resultsMap.has(candidateId)) {
          const fallbackName = r.title ? r.title.replace(/^(perrito|perro|foto de)\s+/i, '').trim() : null;
          resultsMap.set(candidateId, {
            id: candidateId,
            name: fallbackName || r.title || 'Perrito de reporte previo',
            breed: r.breed || null,
            size: r.size || null,
            photo_url: r.photo_url || null,
            created_at: r.created_at,
            origin_report_id: rootAlertId,
          });
        }
      }
    }

    const allDogs = Array.from(resultsMap.values());

    if (!term) {
      return allDogs;
    }

    return allDogs.filter((dog) => [dog.name, dog.breed].some((val) => val?.toLowerCase().includes(term)));
  }

  async createDog(input: NewDogIdentity, userId: string): Promise<DogIdentity> {
    const { data, error } = await this.supabase
      .from('dogs')
      .insert({ ...input, created_by: userId })
      .select('id, name, breed, size, photo_url, created_at')
      .single();
    if (error) throw new Error(this.msg(error.message));
    return data as DogIdentity;
  }

  /**
   * Obtiene la identidad de un perro por su ID en la tabla `dogs`.
   */
  async getDogById(id: string): Promise<DogIdentity | null> {
    const { data, error } = await this.supabase
      .from('dogs')
      .select('id, name, breed, size, photo_url, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(this.msg(error.message));
    return (data as DogIdentity) ?? null;
  }

  /**
   * Garantiza que el dogId referencie un registro real existente en `dogs`.
   * Si el usuario seleccionó un perro proveniente de un reporte anterior cuyo dog_id era nulo,
   * promueve ese reporte a una identidad oficial en la tabla `dogs` y actualiza el reporte origen.
   */
  async resolveDogIdForReport(selectedDog: DogIdentity, userId: string): Promise<string> {
    // 1. Verificar si el ID ya existe en la tabla dogs
    const existing = await this.getDogById(selectedDog.id);
    if (existing) {
      return existing.id;
    }

    // 2. Si no existe en `dogs`, proviene de un dog_report histórico sin dog_id.
    // Creamos la identidad oficial en `dogs` para satisfacer la FK constraint `dog_reports_dog_id_fkey`.
    const newDog = await this.createDog(
      {
        name: selectedDog.name,
        breed: selectedDog.breed,
        size: selectedDog.size,
        photo_url: selectedDog.photo_url,
      },
      userId,
    );

    // 3. Si el ID del perro seleccionado era el ID de un reporte previo, vinculamos
    // ese reporte anterior a la nueva identidad para mantener el historial unificado.
    try {
      await this.supabase.from('dog_reports').update({ dog_id: newDog.id }).eq('id', selectedDog.id);
    } catch {
      // Si falla actualizar el reporte anterior (por ejemplo por permisos RLS),
      // no abortamos, ya que la nueva identidad en `dogs` ya fue creada con éxito.
    }

    return newDog.id;
  }

  /** Solo se usa para deshacer un perro creado si falla la publicación del reporte. */
  async deleteDog(id: string): Promise<void> {
    const { error } = await this.supabase.from('dogs').delete().eq('id', id);
    if (error) throw new Error(this.msg(error.message));
  }

  async update(id: string, patch: ReportPatch): Promise<DogReport> {
    let { data, error } = await this.supabase.from('dog_reports').update(patch).eq('id', id).select(SELECT).single();
    if (error && this.isOptionalSchemaError(error)) {
      console.warn(
        '[ReportsService.update] Relaciones opcionales no disponibles, actualizando alerta base:',
        error.message,
      );
      ({ data, error } = await this.supabase
        .from('dog_reports')
        .update(patch)
        .eq('id', id)
        .select(FALLBACK_SELECT)
        .single());
    }
    if (error) throw new Error(this.msg(error.message));
    return this.withPhotos([data as unknown as DogReport])[0];
  }

  async updateStatus(id: string, status: ReportStatus): Promise<void> {
    const { error } = await this.supabase.from('dog_reports').update({ report_status: status }).eq('id', id);
    if (error) throw new Error(this.msg(error.message));
  }

  async listPhotos(reportId: string): Promise<ReportPhoto[]> {
    const { data, error } = await this.supabase
      .from('dog_report_photos')
      .select('id, report_id, photo_url, photo_path, position, is_primary')
      .eq('report_id', reportId)
      .order('position', { ascending: true });
    if (error) throw new Error(this.msg(error.message));
    return (data ?? []) as ReportPhoto[];
  }

  async syncPhotos(
    reportId: string,
    desired: { photo_url: string; photo_path: string | null; is_primary: boolean }[],
  ): Promise<void> {
    const current = await this.listPhotos(reportId);
    const keyOf = (photo: { photo_url: string; photo_path: string | null }): string =>
      photo.photo_path ?? photo.photo_url;
    const desiredKeys = new Set(desired.map(keyOf));
    const removed = current.filter((photo) => !desiredKeys.has(keyOf(photo)));

    if (removed.length > 0) {
      const { error } = await this.supabase
        .from('dog_report_photos')
        .delete()
        .in(
          'id',
          removed.map((photo) => photo.id),
        );
      if (error) throw new Error(this.msg(error.message));
      for (const photo of removed) {
        if (!photo.photo_path) continue;
        try {
          await this.storage.deletePhoto(photo.photo_path);
        } catch {
          // la foto huérfana no es crítica
        }
      }
    }

    // Se limpia antes para no chocar con el índice único de foto principal.
    const { error: clearError } = await this.supabase
      .from('dog_report_photos')
      .update({ is_primary: false })
      .eq('report_id', reportId);
    if (clearError) throw new Error(this.msg(clearError.message));

    const kept = current.filter((photo) => !removed.includes(photo));
    const keptByKey = new Map(kept.map((photo) => [keyOf(photo), photo]));
    const primaryIndex = desired.findIndex((photo) => photo.is_primary);
    const effectivePrimary = primaryIndex >= 0 ? primaryIndex : desired.length > 0 ? 0 : -1;

    for (const [index, photo] of desired.entries()) {
      const values = {
        photo_url: photo.photo_url,
        photo_path: photo.photo_path,
        position: index,
        is_primary: index === effectivePrimary,
      };
      const existing = keptByKey.get(keyOf(photo));
      const result = existing
        ? await this.supabase.from('dog_report_photos').update(values).eq('id', existing.id)
        : await this.supabase.from('dog_report_photos').insert({ report_id: reportId, ...values });
      if (result.error) throw new Error(this.msg(result.error.message));
    }
  }

  async listByUser(userId: string): Promise<DogReport[]> {
    return this.listMine(userId);
  }

  async remove(report: Pick<DogReport, 'id' | 'photo_path'>): Promise<void> {
    let photos: ReportPhoto[] = [];
    try {
      photos = await this.listPhotos(report.id);
    } catch {
      // Si la tabla de fotos aún no existe, se limpia solo la foto principal.
    }
    const { error } = await this.supabase.from('dog_reports').delete().eq('id', report.id);
    if (error) throw new Error(this.msg(error.message));
    const paths = new Set(
      [report.photo_path, ...photos.map((photo) => photo.photo_path)].filter((path): path is string => Boolean(path)),
    );
    for (const path of paths) {
      try {
        await this.storage.deletePhoto(path);
      } catch {
        // la foto huérfana no es crítica
      }
    }
  }

  /** Emite cada vez que cambia un reporte o un comentario (Supabase Realtime) */
  changes$(): Observable<void> {
    return new Observable<void>((subscriber) => {
      const channel = this.supabase
        .channel(`reports-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dog_reports' }, () => subscriber.next())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'report_comments' }, () => subscriber.next())
        .subscribe();
      return () => {
        this.supabase.removeChannel(channel);
      };
    });
  }

  /**
   * Detecta fallos que solo afectan a datos opcionales (columna nueva, tabla de
   * fotos o relación aún no migrada). En esos casos se reintenta con las
   * columnas base para no dejar el mapa ni el feed vacíos.
   */
  private isOptionalSchemaError(error: { code?: string; message: string }): boolean {
    if (error.code && OPTIONAL_SCHEMA_CODES.has(error.code)) return true;
    return /could not find the table|does not exist|schema cache|relationship/i.test(error.message);
  }

  /** Supabase devuelve la relación como `dog_report_photos`; la UI consume `photos`. */
  private withPhotos(reports: DogReport[]): DogReport[] {
    return reports.map((report) => {
      const row = report as DogReport & { dog_report_photos?: ReportPhoto[] | null };
      return { ...report, photos: row.photos ?? row.dog_report_photos ?? [] };
    });
  }

  private msg(message: string): string {
    return message.toLowerCase().includes('failed to fetch')
      ? 'Sin conexión: revisa tu internet.'
      : 'Error del servidor: ' + message;
  }
}
