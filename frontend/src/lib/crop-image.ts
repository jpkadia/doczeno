/**
 * Utility functions for HTML5 Canvas image cropping and manipulation
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    // Safari / iOS WebKit throws security error or fails when crossOrigin is set on blob: or data: URIs
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      image.setAttribute("crossOrigin", "anonymous");
    }
    image.src = url;
  });
}

export function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Crops and rotates an image using an offscreen HTML5 Canvas.
 * Caps output resolution to a maximum dimension of 1200px for optimal speed and sharpness.
 * Employs 0.86 JPEG quality for fast compression and lightweight uploads (~150KB-250KB).
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0,
  fileName = "doctor-photo.jpg"
): Promise<{ file: File; objectUrl: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  if (!ctx) {
    throw new Error("Could not create canvas context for image cropping");
  }

  const rotRad = getRadianAngle(rotation);

  // Calculate bounding box of the rotated image
  const bBoxWidth = Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight = Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas context to allow rotation around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw rotated image onto canvas
  ctx.drawImage(image, 0, 0);

  // Calculate optimized output dimensions (max 1200px) to prevent massive memory usage and slow uploads
  const MAX_OUTPUT_DIMENSION = 1200;
  let targetWidth = Math.max(1, Math.round(pixelCrop.width));
  let targetHeight = Math.max(1, Math.round(pixelCrop.height));

  if (targetWidth > MAX_OUTPUT_DIMENSION || targetHeight > MAX_OUTPUT_DIMENSION) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.max(1, Math.round((targetHeight * MAX_OUTPUT_DIMENSION) / targetWidth));
      targetWidth = MAX_OUTPUT_DIMENSION;
    } else {
      targetWidth = Math.max(1, Math.round((targetWidth * MAX_OUTPUT_DIMENSION) / targetHeight));
      targetHeight = MAX_OUTPUT_DIMENSION;
    }
  }

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Could not create cropped canvas context");
  }

  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;

  // Enable smooth bicubic image scaling
  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas export to blob failed"));
          return;
        }
        const file = new File([blob], fileName.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" });
        const objectUrl = URL.createObjectURL(blob);
        resolve({ file, objectUrl });
      },
      "image/jpeg",
      0.86
    );
  });
}
