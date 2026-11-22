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
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Crops and rotates an image using an offscreen HTML5 Canvas
 * Returns both a File object (for multipart upload) and an objectUrl (for instant preview)
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0,
  fileName = "doctor-photo.jpg"
): Promise<{ file: File; objectUrl: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

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

  // Extract the specific cropped square region onto a new canvas
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Could not create cropped canvas context");
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas export to blob failed"));
          return;
        }
        const file = new File([blob], fileName, { type: "image/jpeg" });
        const objectUrl = URL.createObjectURL(blob);
        resolve({ file, objectUrl });
      },
      "image/jpeg",
      0.95
    );
  });
}
