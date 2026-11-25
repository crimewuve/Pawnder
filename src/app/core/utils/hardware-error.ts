export type HardwareErrorKind = 'denied' | 'cancelled' | 'unavailable' | 'timeout' | 'unknown';

export class HardwareError extends Error {
  constructor(
    public readonly kind: HardwareErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'HardwareError';
  }
}