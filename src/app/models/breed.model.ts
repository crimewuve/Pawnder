export interface Breed {
  id: string;
  name: string;
}

/** Respuesta cruda de Dog API v2 */
export interface DogApiBreedItem {
  id: string;
  type: string;
  attributes: {
    name: string;
    description?: string;
  };
}

export interface DogApiBreedsResponse {
  data: DogApiBreedItem[];
  meta?: {
    pagination?: {
      current?: number;
      next?: number;
      last?: number;
      records?: number;
    };
  };
}