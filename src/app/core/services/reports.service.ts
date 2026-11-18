import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DogReport, NewDogReport, ReportFilters, ReportStatus } from '../../models/dog-report.model';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

const SELECT = '*, profiles(display_name), report_comments(count)';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);

  async list(filters?: Partial<ReportFilters>): Promise<DogReport[]> {
    let query = this.supabase.from('dog_reports').select(SELECT);
    if (filters?.urgency && filters.urgency !== 'todas') {
      query = query.eq('urgency_level', filters.urgency);
    }
    if (filters?.zone?.trim()) {
      query = query.ilike('zone', `%${filters.zone.trim()}%`);
    }
    if (filters?.breed?.trim()) {
      query = query.ilike('breed', `%${filters.breed.trim()}%`);
    }
    const { data, error } = await query.order('created_at', {
      ascending: filters?.order === 'antiguos',
    });
    if (error) throw new Error(this.msg(error.message));
    return (data ?? []) as unknown as DogReport[];
  }

  async listMine(userId: string): Promise<DogReport[]> {
    const { data, error } = await this.supabase
      .from('dog_reports')
      .select(SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(this.msg(error.message));
    return (data ?? []) as unknown as DogReport[];
  }

  async getById(id: string): Promise<DogReport> {
    const { data, error } = await this.supabase
      .from('dog_reports')
      .select(SELECT)
      .eq('id', id)
      .single();
    if (error) throw new Error(this.msg(error.message));
    return data as unknown as DogReport;
  }

  async create(input: NewDogReport, userId: string): Promise<DogReport> {
    const { data, error } = await this.supabase
      .from('dog_reports')
      .insert({ ...input, user_id: userId })
      .select(SELECT)
      .single();
    if (error) throw new Error(this.msg(error.message));
    return data as unknown as DogReport;
  }

  async updateStatus(id: string, status: ReportStatus): Promise<void> {
    const { error } = await this.supabase
      .from('dog_reports')
      .update({ report_status: status })
      .eq('id', id);
    if (error) throw new Error(this.msg(error.message));
  }

  async remove(report: Pick<DogReport, 'id' | 'photo_path'>): Promise<void> {
    const { error } = await this.supabase.from('dog_reports').delete().eq('id', report.id);
    if (error) throw new Error(this.msg(error.message));
    if (report.photo_path) {
      try {
        await this.storage.deletePhoto(report.photo_path);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dog_reports' }, () =>
          subscriber.next()
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'report_comments' }, () =>
          subscriber.next()
        )
        .subscribe();
      return () => {
        this.supabase.removeChannel(channel);
      };
    });
  }

  private msg(message: string): string {
    return message.toLowerCase().includes('failed to fetch')
      ? 'Sin conexión: revisa tu internet.'
      : 'Error del servidor: ' + message;
  }
}