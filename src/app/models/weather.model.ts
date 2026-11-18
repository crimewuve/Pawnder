/** Respuesta cruda de Open-Meteo (solo los campos que usamos) */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

/** Copia del clima que se guarda junto al reporte */
export interface WeatherSnapshot {
  weather_code: number;
  weather_description: string;
  weather_emoji: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  wind_speed: number;
}