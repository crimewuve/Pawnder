import { Injectable, signal } from '@angular/core';
import { Breed } from '../../models/breed.model';

export interface DogAnalysis {
  status: 'dog' | 'not-dog' | 'unavailable';
  dogScore: number;
  breedLabel: string | null;
  breedScore: number;
  matchedBreed: string | null;
  /** Lo que se propone al usuario (raza de la lista, o "Mestizo" si hay duda) */
  suggestion: string | null;
}

type Classifier = ((
  input: string,
  options?: Record<string, unknown>
) => Promise<{ label: string; score: number }[]>) & {
  model?: { config?: { id2label?: Record<string, string> } };
};

const MODEL_ID = 'Xenova/fastvit_t12.apple_dist_in1k';
// En ImageNet-1k las clases 151 a 268 son razas de perro
const DOG_FIRST = 151;
const DOG_LAST = 268;
const MIN_DOG_SCORE = 0.2;
const MIN_BREED_SCORE = 0.3;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca en las razas de Dog API la que mejor corresponde a una etiqueta de ImageNet */
function matchBreed(label: string, breeds: Breed[]): string | null {
  const synonyms = label.split(',').map(normalize).filter(Boolean);
  let best: { name: string; score: number } | null = null;

  for (const breed of breeds) {
    const name = normalize(breed.name);
    for (const syn of synonyms) {
      let score = 0;
      if (name === syn) {
        score = 1;
      } else if (name.length >= 4 && syn.length >= 4 && (name.includes(syn) || syn.includes(name))) {
        score = 0.8;
      } else {
        const a = new Set(name.split(' '));
        const b = new Set(syn.split(' '));
        const inter = [...a].filter((x) => b.has(x)).length;
        score = inter / new Set([...a, ...b]).size;
      }
      if (!best || score > best.score) best = { name: breed.name, score };
    }
  }
  return best && best.score >= 0.6 ? best.name : null;
}

@Injectable({ providedIn: 'root' })
export class DogVisionService {
  readonly modelStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  private classifierPromise?: Promise<Classifier>;
  private readonly dogLabels = new Set<string>();

  /** Empieza a descargar el modelo en segundo plano (queda en caché del navegador) */
  preload(): void {
    this.load().catch(() => undefined);
  }

  private load(): Promise<Classifier> {
    if (!this.classifierPromise) {
      this.modelStatus.set('loading');
      this.classifierPromise = (async () => {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;

        // Se castea porque el tipo de pipeline() es demasiado complejo para TypeScript
        const create = pipeline as unknown as (task: string, model: string) => Promise<Classifier>;
        const classifier = await create('image-classification', MODEL_ID);

        const id2label = classifier.model?.config?.id2label ?? {};
        for (let i = DOG_FIRST; i <= DOG_LAST; i++) {
          const label = id2label[String(i)];
          if (label) this.dogLabels.add(label);
        }
        this.modelStatus.set('ready');
        return classifier;
      })().catch((err) => {
        this.modelStatus.set('error');
        this.classifierPromise = undefined;
        throw err;
      });
    }
    return this.classifierPromise;
  }

  async analyze(imageUrl: string, apiBreeds: Breed[]): Promise<DogAnalysis> {
    const unavailable: DogAnalysis = {
      status: 'unavailable', dogScore: 0, breedLabel: null, breedScore: 0,
      matchedBreed: null, suggestion: null,
    };

    try {
      const classifier = await this.load();
      if (this.dogLabels.size === 0) return unavailable;

      const results = await classifier(imageUrl, { top_k: 1000 });

      let dogScore = 0;
      let best: { label: string; score: number } | null = null;
      for (const r of results) {
        if (this.dogLabels.has(r.label)) {
          dogScore += r.score;
          if (!best || r.score > best.score) best = r;
        }
      }

      if (dogScore < MIN_DOG_SCORE || !best) {
        return { ...unavailable, status: 'not-dog', dogScore };
      }

      const confident = best.score >= MIN_BREED_SCORE;
      const matched = confident ? matchBreed(best.label, apiBreeds) : null;
      return {
        status: 'dog',
        dogScore,
        breedLabel: best.label.split(',')[0].trim(),
        breedScore: best.score,
        matchedBreed: matched,
        suggestion: confident ? matched : 'Mestizo',
      };
    } catch (e) {
      console.error('Análisis de imagen no disponible', e);
      return unavailable;
    }
  }
}
