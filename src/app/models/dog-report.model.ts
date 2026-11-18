export type DogSize = 'pequeno' | 'mediano' | 'grande';
export type UrgencyLevel = 'normal' | 'alta' | 'critica';
export type UrgencyCategory =
  | 'herido'
  | 'enfermo'
  | 'embarazada'
  | 'cachorros'
  | 'atrapado'
  | 'clima_adverso'
  | 'otro';
export type ReportStatus = 'activo' | 'en_proceso' | 'resuelto';

export interface DogReport {
  id: string;
  user_id: string;
  title: string;
  photo_url: string;
  photo_path: string | null;
  breed: string;
  size: DogSize;
  description: string;
  situation: string | null;
  found_at: string;
  urgency_level: UrgencyLevel;
  urgency_category: UrgencyCategory | null;
  latitude: number;
  longitude: number;
  zone: string;
  weather_code: number | null;
  weather_description: string | null;
  weather_emoji: string | null;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  report_status: ReportStatus;
  created_at: string;
  updated_at: string;
  // Campos para privacidad y seguridad de mascotas
  is_approximate_location?: boolean;
  is_emergency?: boolean;
  custom_category?: string | null;
  // Relaciones que trae Supabase en las consultas con "select"
  profiles?: { display_name: string } | null;
  report_comments?: { count: number }[];
}

/** Datos que el formulario envía al crear un reporte (user_id lo pone el servicio) */
export type NewDogReport = Omit<
  DogReport,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'profiles' | 'report_comments'
>;

export interface ReportFilters {
  zone: string;
  breed: string;
  urgency: UrgencyLevel | 'todas';
  order: 'recientes' | 'antiguos';
}

export const DEFAULT_FILTERS: ReportFilters = {
  zone: '',
  breed: '',
  urgency: 'todas',
  order: 'recientes',
};

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const SIZE_OPTIONS: Option<DogSize>[] = [
  { value: 'pequeno', label: 'Pequeño' },
  { value: 'mediano', label: 'Mediano' },
  { value: 'grande', label: 'Grande' },
];

export const URGENCY_LEVEL_OPTIONS: Option<UrgencyLevel>[] = [
  { value: 'alta', label: 'Alta prioridad' },
  { value: 'critica', label: 'Crítica / Inmediata' },
];

export const URGENCY_CATEGORY_OPTIONS: Option<UrgencyCategory>[] = [
  { value: 'herido', label: 'Perro herido o atropellado' },
  { value: 'enfermo', label: 'Perro enfermo / desnutrido' },
  { value: 'embarazada', label: 'Perra en estado de embarazo' },
  { value: 'cachorros', label: 'Cachorros en la calle / desamparados' },
  { value: 'atrapado', label: 'Perro atrapado o en peligro inminente' },
  { value: 'clima_adverso', label: 'Expuesto a condiciones ambientales extremas' },
  { value: 'otro', label: 'Otro (especificar)' },
];

export const STATUS_OPTIONS: Option<ReportStatus>[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_proceso', label: 'En proceso de ayuda' },
  { value: 'resuelto', label: 'Resuelto / Seguro' },
];

export function labelOf<T extends string>(options: Option<T>[], value: T | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? '';
}
