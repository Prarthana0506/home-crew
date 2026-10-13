/**
 * Image processing utilities:
 * 1. EXIF metadata strip (HTML5 Canvas drawing eliminates all EXIF headers and GPS tags)
 * 2. Resolution capping (max 1280px)
 * 3. Quality compression (0.82 JPEG/WebP)
 */

export interface ProcessedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

export async function processImageAttachment(
  file: File,
  maxDimension: number = 1280,
  quality: number = 0.82
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // 1. Read file as Object URL or Data URL
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to parse image data'));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // 2. Scale down if exceeds maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // 3. Draw on offscreen Canvas to strip EXIF and re-encode
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // Draw image clean
        ctx.drawImage(img, 0, 0, width, height);

        // 4. Export as compressed JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to generate image blob'));
              return;
            }

            resolve({
              dataUrl,
              blob,
              width,
              height,
              originalSizeBytes: file.size,
              compressedSizeBytes: blob.size
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
