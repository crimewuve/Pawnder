import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export const PREF_KEYS = {
  filters: 'pawnder.filters',
  reportDraft: 'pawnder.reportDraft',
  mapFilters: 'pawnder.mapFilters',
} as const;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  async get<T>(key: string, fallback: T): Promise<T> {
    const { value } = await Preferences.get({ key });
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}