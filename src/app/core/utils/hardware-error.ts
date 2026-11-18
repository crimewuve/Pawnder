export type HardwareErrorKind = 'denied' | 'cancelled' | 'unavailable' | 'timeout' | 'unknown';

/** Error propio para cámara y GPS, con un tipo para decidir qué mensaje mostrar */
export class HardwareError extends Error {
  constructor(
    public readonly kind: HardwareErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'HardwareError';
  }
}