import type QRCode from "qrcode";

type QrModule = typeof QRCode;

let qrModulePromise: Promise<QrModule> | null = null;

async function getQrModule(): Promise<QrModule> {
  if (!qrModulePromise) {
    qrModulePromise = import("qrcode/lib/browser") as Promise<QrModule>;
  }
  return qrModulePromise;
}

export async function qrToDataURL(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions,
): Promise<string> {
  const qr = await getQrModule();
  return qr.toDataURL(text, options);
}

export async function qrToString(
  text: string,
  options?: QRCode.QRCodeToStringOptions,
): Promise<string> {
  const qr = await getQrModule();
  return qr.toString(text, options);
}

export async function qrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: QRCode.QRCodeRenderersOptions,
): Promise<void> {
  const qr = await getQrModule();
  await qr.toCanvas(canvas, text, options);
}

export async function qrToSvgDataURL(
  text: string,
  options?: QRCode.QRCodeToStringOptions,
): Promise<string> {
  const svg = await qrToString(text, { ...options, type: "svg" });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}