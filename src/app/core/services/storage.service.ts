import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly bucket = environment.storageBucket;

  /** Sube la foto a <user_id>/<archivo> (así lo exigen las políticas de Storage) */
  async uploadPhoto(blob: Blob, userId: string): Promise<{ path: string; publicUrl: string }> {
    const type = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, blob, { contentType: type, upsert: false });
    if (error) {
      throw new Error(
        error.message.toLowerCase().includes('failed to fetch')
          ? 'Sin conexión: no se pudo subir la fotografía.'
          : 'No se pudo subir la fotografía: ' + error.message
      );
    }
    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  async deletePhoto(path: string): Promise<void> {
    await this.supabase.storage.from(this.bucket).remove([path]);
  }
}