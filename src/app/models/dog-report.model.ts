export type DogSize = 'pequeno' | 'mediano' | 'grande';
export type UrgencyLevel = 'normal' | 'alta' | 'critica';
export type UrgencyCategory = 'herido' | 'enfermo' | 'embarazada' | 'cachorros' | 'atrapado' | 'clima_adverso' | 'otro';
export type ReportStatus = 'activo' | 'en_proceso' | 'resuelto';

export interface ReportPhoto {
  id: string;
  report_id: string;
  photo_url: string;
  photo_path: string | null;
  position: number;
  is_primary: boolean;
}


export interface DogIdentity {
  id: string;
  name: string | null;
  breed: string | null;
  size: DogSize | null;
  photo_url: string | null;
  created_at: string;
  
  origin_report_id?: string | null;
}

export interface NewDogIdentity {
  name: string | null;
  breed: string | null;
  size: DogSize | null;
  photo_url: string | null;
}

export interface DogReport {
  id: string;
  user_id: string;
  dog_id: string | null;
  parent_report_id?: string | null;
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
  
  
  
  is_approximate_location?: boolean;
  is_emergency?: boolean;
  
  profiles?: { display_name: string; avatar_url?: string | null } | null;
  dogs?: DogIdentity | null;
  report_comments?: { count: number }[];
  photos?: ReportPhoto[];
}

export type ReportPatch = Partial<
  Pick<
    DogReport,
    | 'title'
    | 'photo_url'
    | 'photo_path'
    | 'breed'
    | 'size'
    | 'description'
    | 'situation'
    | 'found_at'
    | 'urgency_level'
    | 'urgency_category'
    | 'latitude'
    | 'longitude'
    | 'zone'
    | 'weather_code'
    | 'weather_description'
    | 'weather_emoji'
    | 'temperature'
    | 'humidity'
    | 'precipitation'
    | 'wind_speed'
    | 'report_status'
  >
>;


export type NewDogReport = Omit<
  DogReport,
  | 'id'
  | 'user_id'
  | 'created_at'
  | 'updated_at'
  | 'profiles'
  | 'report_comments'
  | 'photos'
  | 'is_approximate_location'
  | 'is_emergency'
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
