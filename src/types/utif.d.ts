declare module 'utif' {
  interface TiffImage {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }

  interface Utif {
    decode(buffer: ArrayBuffer): TiffImage[];
    decodeImage(buffer: ArrayBuffer, image: TiffImage): void;
    toRGBA8(image: TiffImage): Uint8Array;
  }

  const UTIF: Utif;
  export default UTIF;
}
