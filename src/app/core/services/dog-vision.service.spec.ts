import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Breed } from '../../models/breed.model';

import { DogVisionService } from './dog-vision.service';

const { pipelineMock } = vi.hoisted(() => ({ pipelineMock: vi.fn() }));

vi.mock('@huggingface/transformers', () => ({
  env: { allowLocalModels: false },
  pipeline: pipelineMock,
}));

const id2label = {
  '151': 'Labrador retriever',
  '152': 'Golden retriever',
};

const breeds: Breed[] = [
  { id: 'lab', name: 'Labrador Retriever' },
  { id: 'gold', name: 'Golden Retriever' },
];

const photo = new Blob(['photo'], { type: 'image/jpeg' });

function fakeContext(): CanvasRenderingContext2D {
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(160 * 160 * 4).fill(180),
    })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('DogVisionService', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext());
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['crop'], { type: 'image/jpeg' }));
    });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 640, height: 480, close: vi.fn() })),
    );
    pipelineMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('localizes the dog first and returns a confident breed match', async () => {
    const detector = vi.fn(async () => [
      {
        label: 'dog',
        score: 0.96,
        box: { xmin: 80, ymin: 60, xmax: 420, ymax: 400 },
      },
    ]);
    const classifier = Object.assign(
      vi.fn(async () => [
        { label: 'Labrador retriever', score: 0.82 },
        { label: 'Golden retriever', score: 0.06 },
      ]),
      { model: { config: { id2label } } },
    );
    pipelineMock.mockImplementation(async (task: string) => (task === 'object-detection' ? detector : classifier));

    const result = await new DogVisionService().analyze(photo, breeds);

    expect(result.status).toBe('dog');
    expect(result.detectionMethod).toBe('detector');
    expect(result.region).toEqual({ x: 80, y: 60, width: 340, height: 340 });
    expect(result.suggestion).toBe('Labrador Retriever');
    expect(result.uncertain).toBe(false);
    expect(result.candidates.length).toBe(2);
  });

  it('marks close scores as a possible mixed breed', async () => {
    const detector = vi.fn(async () => [
      {
        label: 'dog',
        score: 0.91,
        box: { xmin: 10, ymin: 10, xmax: 500, ymax: 400 },
      },
    ]);
    const classifier = Object.assign(
      vi.fn(async () => [
        { label: 'Labrador retriever', score: 0.51 },
        { label: 'Golden retriever', score: 0.43 },
      ]),
      { model: { config: { id2label } } },
    );
    pipelineMock.mockImplementation(async (task: string) => (task === 'object-detection' ? detector : classifier));

    const result = await new DogVisionService().analyze(photo, breeds);

    expect(result.suggestion).toBe('Mestizo');
    expect(result.uncertain).toBe(true);
    expect(result.matchedBreed).toBeNull();
  });

  it('falls back to whole-image classification and rejects non-dog photos', async () => {
    const detector = vi.fn(async () => [
      { label: 'cat', score: 0.88, box: { xmin: 0, ymin: 0, xmax: 100, ymax: 100 } },
    ]);
    const classifier = Object.assign(
      vi.fn(async () => [{ label: 'tabby cat', score: 0.74 }]),
      { model: { config: { id2label } } },
    );
    pipelineMock.mockImplementation(async (task: string) => (task === 'object-detection' ? detector : classifier));

    const result = await new DogVisionService().analyze(photo, breeds);

    expect(result.status).toBe('not-dog');
    expect(result.detectionMethod).toBeNull();
    expect(result.breedLabel).toBeNull();
    expect(result.message).toContain('No pudimos encontrar un perro');
  });
});
