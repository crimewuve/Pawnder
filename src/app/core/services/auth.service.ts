import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly displayName = computed(
    () =>
      this.profile()?.display_name ??
      (this.user()?.user_metadata?.['display_name'] as string | undefined) ??
      'Usuario'
  );

  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  /** Espera a que se recupere la sesión guardada (lo usan los guards) */
  whenReady(): Promise<void> {
    return this.ready;
  }

  private async init(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      this.session.set(data.session);
      if (data.session) {
        await this.loadProfile(data.session.user.id);
      }
    } catch (e) {
      console.error('No se pudo recuperar la sesión', e);
    }

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (session) {
        // setTimeout evita bloqueos al llamar a Supabase dentro de este callback
        setTimeout(() => this.loadProfile(session.user.id), 0);
      } else {
        this.profile.set(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      this.profile.set(data as Profile);
    }
  }

  /** Devuelve needsConfirmation=true si Supabase exige confirmar el correo */
  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) throw new Error(this.translate(error.message));
    return { needsConfirmation: data.session === null };
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.translate(error.message));
  }

  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error(this.translate(error.message));
  }

  async updateDisplayName(name: string): Promise<void> {
    const user = this.user();
    if (!user) throw new Error('Debes iniciar sesión.');
    const { error } = await this.supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', user.id);
    if (error) throw new Error('No se pudo actualizar el alias.');
    await this.loadProfile(user.id);
  }

  private translate(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (m.includes('already registered') || m.includes('already been registered'))
      return 'Este correo ya está registrado.';
    if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.';
    if (m.includes('at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    if (m.includes('failed to fetch') || m.includes('network'))
      return 'Sin conexión: revisa tu internet.';
    if (m.includes('invalid email') || m.includes('unable to validate email'))
      return 'El correo no es válido.';
    return 'No se pudo completar la operación: ' + message;
  }
}