import { isNative } from './platform';

/**
 * Pick an image: native → camera/gallery prompt via @capacitor/camera; web → file input (camera on phones).
 * Returns null when the user cancels.
 */
export async function pickImage(preferCamera: boolean): Promise<Blob | null> {
  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: preferCamera ? CameraSource.Prompt : CameraSource.Photos,
        quality: 85,
        width: 1600,
        correctOrientation: true,
        promptLabelHeader: 'Ambil gambar',
        promptLabelPhoto: 'Dari galeri',
        promptLabelPicture: 'Kamera',
        promptLabelCancel: 'Batal',
      });
      if (!photo.webPath) return null;
      return await (await fetch(photo.webPath)).blob();
    } catch {
      return null; // cancelled or permission denied
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (preferCamera) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
