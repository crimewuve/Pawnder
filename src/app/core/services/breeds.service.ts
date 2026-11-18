import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, reduce, shareReplay, throwError } from 'rxjs';
import { Breed, DogApiBreedItem, DogApiBreedsResponse } from '../../models/breed.model';
import { describeHttpError } from '../utils/http-error';

@Injectable({ providedIn: 'root' })
export class BreedsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dogapi.dog/api/v2/breeds';
  private readonly maxPages = 15;
  private cache$?: Observable<Breed[]>;

  /** Opciones adicionales que no vienen de la API */
  readonly extraOptions: Breed[] = [
    { id: 'mestizo', name: 'Mestizo' },
    { id: 'desconocida', name: 'Raza desconocida' },
  ];

  /** Lista completa de razas (recorre la paginación). Se guarda en memoria tras la primera carga. */
  getBreeds(): Observable<Breed[]> {
    if (!this.cache$) {
      this.cache$ = this.fetchPage(1).pipe(
        expand((res) => {
          const next = res.meta?.pagination?.next;
          return next && next <= this.maxPages ? this.fetchPage(next) : EMPTY;
        }),
        reduce((acc, res) => acc.concat(res.data ?? []), [] as DogApiBreedItem[]),
        map((items) => this.toBreeds(items)),
        shareReplay(1)
      );
    }
    return this.cache$;
  }

  private fetchPage(page: number): Observable<DogApiBreedsResponse> {
    return this.http
      .get<DogApiBreedsResponse>(`${this.baseUrl}?page[number]=${page}`)
      .pipe(
        catchError((err) =>
          throwError(() => new Error(describeHttpError(err, 'el servicio de razas')))
        )
      );
  }

  private toBreeds(items: DogApiBreedItem[]): Breed[] {
    const seen = new Set<string>();
    const breeds: Breed[] = [];
    for (const item of items) {
      const name = item.attributes?.name?.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        breeds.push({ id: item.id, name });
      }
    }
    breeds.sort((a, b) => a.name.localeCompare(b.name));
    return [...this.extraOptions, ...breeds];
  }
}