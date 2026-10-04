declare module "gifenc" {
  export type GifPalette = number[][];

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: GifPalette; delay?: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoder;
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number): GifPalette;
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: GifPalette,
  ): Uint8Array;
}
