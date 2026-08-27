declare module 'qrcode' {
  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: string;
    type?: string;
    quality?: number;
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  type QRCodeToCanvasOptions = QRCodeToDataURLOptions;
  type QRCodeToStringOptions = QRCodeToDataURLOptions;

  function toDataURL(
    data: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;

  function toCanvas(
    canvasElement: HTMLCanvasElement,
    data: string,
    options?: QRCodeToCanvasOptions
  ): Promise<void>;

  function toString(
    data: string,
    options?: QRCodeToStringOptions
  ): Promise<string>;
}
