import { Injectable, signal } from '@angular/core';

import type { Breed } from '../../models/breed.model';

export interface BreedCandidate {
  label: string;
  score: number;
  breed: string | null;
}

export interface DogRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageQuality {
  width: number;
  height: number;
  brightness: number;
  blur: number;
  notes: string[];
}

export interface DogAnalysis {
  status: 'dog' | 'not-dog' | 'unavailable';
  dogScore: number;
  detectionMethod: 'detector' | 'classifier' | null;
  region: DogRegion | null;
  breedLabel: string | null;
  breedScore: number;
  candidates: BreedCandidate[];
  matchedBreed: string | null;
  suggestion: string | null;
  uncertain: boolean;
  quality: ImageQuality | null;
  message: string;
}

interface ScoreItem {
  label: string;
  score: number;
}

interface DetectionItem extends ScoreItem {
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface PipeModel {
  config?: { id2label?: Record<string, string> };
}

type AnyPipe = ((input: Blob, options?: Record<string, unknown>) => Promise<unknown>) & {
  model?: PipeModel;
};

const DETECTOR_ID = 'Xenova/detr-resnet-50';
const CLASSIFIER_ID = 'Xenova/fastvit_t12.apple_dist_in1k';
const DOG_FIRST = 151;
const DOG_LAST = 268;
const DETECTION_MIN = 0.25;
const CLASSIFIER_DOG_MIN = 0.3;
const BREED_MIN = 0.22;
const MAX_CANDIDATES = 3;
const AMBIGUITY_RATIO = 0.6;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchBreed(label: string, breeds: Breed[]): string | null {
  const synonyms = label.split(',').map(normalize).filter(Boolean);
  let best: { name: string; score: number } | null = null;

  for (const breed of breeds) {
    const name = normalize(breed.name);
    for (const syn of synonyms) {
      let score: number;
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
  readonly modelStatus = signal<'idle' | 'loading' | 'ready' | 'partial' | 'error'>('idle');

  private detectorPromise?: Promise<AnyPipe | null>;
  private classifierPromise?: Promise<AnyPipe | null>;
  private classifierReady = false;
  private detectorReady = false;
  private classifierFailed = false;
  private detectorFailed = false;
  private readonly dogLabels = new Set<string>();

  preload(): void {
    void this.loadClassifier();
    void this.loadDetector();
  }

  private async createPipeline(task: string, model: string): Promise<AnyPipe> {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    const factory = pipeline as unknown as (
      task: string,
      model: string,
      options?: Record<string, unknown>,
    ) => Promise<AnyPipe>;
    return factory(task, model, { dtype: 'q8' });
  }

  private loadDetector(): Promise<AnyPipe | null> {
    if (!this.detectorPromise) {
      this.updateStatus('loading');
      this.detectorPromise = this.createPipeline('object-detection', DETECTOR_ID)
        .then((pipe) => {
          this.detectorReady = true;
          this.updateStatus();
          return pipe;
        })
        .catch(() => {
          this.detectorFailed = true;
          this.detectorPromise = undefined;
          this.updateStatus();
          return null;
        });
    }
    return this.detectorPromise;
  }

  private loadClassifier(): Promise<AnyPipe | null> {
    if (!this.classifierPromise) {
      this.updateStatus('loading');
      this.classifierPromise = this.createPipeline('image-classification', CLASSIFIER_ID)
        .then((pipe) => {
          const id2label = pipe.model?.config?.id2label ?? {};
          for (let i = DOG_FIRST; i <= DOG_LAST; i++) {
            const label = id2label[String(i)];
            if (label) this.dogLabels.add(label);
          }
          this.classifierReady = true;
          this.updateStatus();
          return pipe;
        })
        .catch(() => {
          this.classifierFailed = true;
          this.classifierPromise = undefined;
          this.updateStatus();
          return null;
        });
    }
    return this.classifierPromise;
  }

  private updateStatus(force?: 'loading'): void {
    if (force === 'loading' && !this.classifierReady && !this.detectorReady) {
      this.modelStatus.set('loading');
      return;
    }
    if (this.classifierFailed && this.detectorFailed) {
      this.modelStatus.set('error');
    } else if (this.classifierReady) {
      this.modelStatus.set('ready');
    } else if (this.detectorReady) {
      this.modelStatus.set('partial');
    } else if (this.classifierFailed || this.detectorFailed) {
      this.modelStatus.set('error');
    } else {
      this.modelStatus.set('loading');
    }
  }

  async analyze(image: Blob, apiBreeds: Breed[]): Promise<DogAnalysis> {
    const unavailable = (message: string): DogAnalysis => ({
      status: 'unavailable',
      dogScore: 0,
      detectionMethod: null,
      region: null,
      breedLabel: null,
      breedScore: 0,
      candidates: [],
      matchedBreed: null,
      suggestion: null,
      uncertain: true,
      quality: null,
      message,
    });

    try {
      const canvas = await this.toCanvas(image);
      const quality = this.measureQuality(canvas);
      const detector = await this.loadDetector();
      const classifier = await this.loadClassifier();

      if (!classifier && !detector) {
        return unavailable('No pudimos analizar la foto automáticamente. Puedes elegir la raza manualmente.');
      }

      let dogScore = 0;
      let region: DogRegion | null = null;
      let method: 'detector' | 'classifier' | null = null;

      if (detector) {
        try {
          const output = (await detector(image, { threshold: DETECTION_MIN })) as DetectionItem[];
          const hit = output
            .filter((item) => normalize(item.label).includes('dog'))
            .sort((a, b) => b.score - a.score)[0];
          if (hit) {
            dogScore = hit.score;
            method = 'detector';
            region = {
              x: Math.max(0, Math.min(hit.box.xmin, canvas.width)),
              y: Math.max(0, Math.min(hit.box.ymin, canvas.height)),
              width: Math.max(1, Math.min(hit.box.xmax, canvas.width) - Math.max(0, hit.box.xmin)),
              height: Math.max(1, Math.min(hit.box.ymax, canvas.height) - Math.max(0, hit.box.ymin)),
            };
          }
        } catch {
          region = null;
          method = null;
        }
      }

      if (!method) {
        if (!classifier || this.dogLabels.size === 0) {
          return {
            ...unavailable('No pudimos analizar la foto automáticamente. Puedes elegir la raza manualmente.'),
            quality,
          };
        }
        const scores = (await classifier(image, { top_k: null })) as ScoreItem[];
        const dogScores = scores.filter((item) => this.dogLabels.has(item.label));
        dogScore = dogScores.reduce((sum, item) => sum + item.score, 0);
        if (dogScore < CLASSIFIER_DOG_MIN) {
          return {
            status: 'not-dog',
            dogScore,
            detectionMethod: null,
            region: null,
            breedLabel: null,
            breedScore: 0,
            candidates: [],
            matchedBreed: null,
            suggestion: null,
            uncertain: true,
            quality,
            message: 'No pudimos encontrar un perro en esta fotografía. Prueba con otra imagen.',
          };
        }
        method = 'classifier';
      }

      let classification: ScoreItem[] = [];
      if (classifier && this.dogLabels.size > 0) {
        const crop = region ? await this.crop(canvas, region) : null;
        if (crop) {
          classification = (await classifier(crop, { top_k: null })) as ScoreItem[];
          const top = classification
            .filter((item) => this.dogLabels.has(item.label))
            .sort((a, b) => b.score - a.score)[0];
          if (!top || top.score < BREED_MIN) {
            classification = (await classifier(image, { top_k: null })) as ScoreItem[];
          }
        } else {
          classification = (await classifier(image, { top_k: null })) as ScoreItem[];
        }
      }

      const dogScores = classification
        .filter((item) => this.dogLabels.has(item.label))
        .sort((a, b) => b.score - a.score);
      const candidates: BreedCandidate[] = dogScores.slice(0, MAX_CANDIDATES).map((item) => ({
        label: item.label.split(',')[0].trim(),
        score: item.score,
        breed: matchBreed(item.label, apiBreeds),
      }));

      const top = candidates[0] ?? null;
      const second = candidates[1] ?? null;
      const confident = !!top && top.score >= BREED_MIN;
      const ambiguous = !!top && !!second && second.score >= top.score * AMBIGUITY_RATIO;

      let suggestion: string | null;
      let uncertain: boolean;
      let message: string;

      if (!confident) {
        suggestion = 'Raza desconocida';
        uncertain = true;
        message = 'Encontramos un perro, pero no pudimos identificar su raza con seguridad.';
      } else if (ambiguous) {
        suggestion = 'Mestizo';
        uncertain = true;
        message = 'Encontramos un perro. ¡Este pup puede ser mestizo!';
      } else {
        suggestion = top?.breed ?? 'Raza desconocida';
        uncertain = suggestion === 'Raza desconocida';
        message = uncertain
          ? 'Encontramos un perro, pero su raza no está en nuestro catálogo.'
          : '¡Encontramos un perro!';
      }

      if (quality.notes.length > 0) {
        message += ' ' + quality.notes.join(' ');
      }

      const result: DogAnalysis = {
        status: 'dog',
        dogScore,
        detectionMethod: method,
        region,
        breedLabel: top?.label ?? null,
        breedScore: top?.score ?? 0,
        candidates,
        matchedBreed: confident && !ambiguous ? (top?.breed ?? null) : null,
        suggestion,
        uncertain,
        quality,
        message,
      };
      return result;
    } catch (e) {
      console.error('Análisis de imagen no disponible', e);
      return unavailable('No pudimos analizar la foto automáticamente. Puedes elegir la raza manualmente.');
    }
  }

  private async toCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    let source: CanvasImageSource;
    let width: number;
    let height: number;
    let bitmap: ImageBitmap | null = null;
    let objectUrl: string | null = null;

    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } else {
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    }

    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(source, 0, 0);
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return canvas;
  }

  private measureQuality(canvas: HTMLCanvasElement): ImageQuality {
    const size = 160;
    const small = document.createElement('canvas');
    small.width = size;
    small.height = size;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const notes: string[] = [];

    if (!ctx) {
      return { width: canvas.width, height: canvas.height, brightness: 0.5, blur: 0, notes };
    }

    ctx.drawImage(canvas, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const gray = new Float32Array(size * size);
    let brightness = 0;

    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      const value = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      gray[i] = value;
      brightness += value / 255;
    }
    brightness /= gray.length;

    let laplacianSum = 0;
    let laplacianSq = 0;
    let count = 0;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        const laplacian = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size];
        laplacianSum += laplacian;
        laplacianSq += laplacian * laplacian;
        count++;
      }
    }
    const mean = laplacianSum / Math.max(1, count);
    const variance = laplacianSq / Math.max(1, count) - mean * mean;
    const blur = 1 - Math.min(1, Math.max(0, variance) / 120);

    if (brightness < 0.28) notes.push('La foto está un poco oscura, pero vamos a intentarlo.');
    if (brightness > 0.85) notes.push('La foto está muy iluminada, pero igual intentaremos identificar al perro.');
    if (blur > 0.55) notes.push('La foto está un poco borrosa; aún podemos intentarlo.');
    if (Math.min(canvas.width, canvas.height) < 320)
      notes.push('La foto es pequeña, así que la identificación puede ser menos precisa.');

    return { width: canvas.width, height: canvas.height, brightness, blur, notes };
  }

  private async crop(canvas: HTMLCanvasElement, region: DogRegion): Promise<Blob | null> {
    const x = Math.max(0, Math.min(region.x, canvas.width - 1));
    const y = Math.max(0, Math.min(region.y, canvas.height - 1));
    const width = Math.min(region.width, canvas.width - x);
    const height = Math.min(region.height, canvas.height - y);
    if (width < 32 || height < 32) return null;

    const scale = Math.min(1, 1024 / Math.max(width, height));
    const output = document.createElement('canvas');
    output.width = Math.round(width * scale);
    output.height = Math.round(height * scale);
    output.getContext('2d')?.drawImage(canvas, x, y, width, height, 0, 0, output.width, output.height);

    return new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/jpeg', 0.92));
  }
}
