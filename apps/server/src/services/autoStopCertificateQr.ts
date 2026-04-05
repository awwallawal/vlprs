/**
 * QR Code generator for Auto-Stop Certificate (Story 8.2, Task 3)
 *
 * Returns a data:image/png;base64 string embeddable in @react-pdf via <Image src={dataUrl} />.
 */

import QRCode from 'qrcode';

export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
