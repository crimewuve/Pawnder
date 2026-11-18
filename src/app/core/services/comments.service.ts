import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportComment } from '../../models/comment.model';
import { SupabaseService } from './supabase.service';

const SELECT = '*, profiles(display_name)';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly supabase = inject(SupabaseService).client;

  async listForReport(reportId: string): Promise<ReportComment[]> {
    const { data, error } = await this.supabase
      .from('report_comments')
      .select(SELECT)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ReportComment[];
  }

  async addComment(reportId: string, userId: string, content: string): Promise<ReportComment> {
    const { data, error } = await this.supabase
      .from('report_comments')
      .insert({
        report_id: reportId,
        user_id: userId,
        content: content.trim(),
      })
      .select(SELECT)
      .single();

    if (error) throw new Error(error.message);
    return data as unknown as ReportComment;
  }

  changesForReport$(reportId: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      const channel = this.supabase
        .channel(`comments-${reportId}-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'report_comments',
            filter: `report_id=eq.${reportId}`,
          },
          () => subscriber.next()
        )
        .subscribe();

      return () => {
        this.supabase.removeChannel(channel);
      };
    });
  }
}
