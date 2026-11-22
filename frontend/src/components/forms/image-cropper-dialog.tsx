"use client";

import * as React from "react";
import Cropper, { Point, Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImg, CropArea } from "@/lib/crop-image";
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, Loader2, Crop as CropIcon } from "lucide-react";

interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  title?: string;
  description?: string;
  aspect?: number; // 1:1 square by default
  fileName?: string;
  closeOnConfirm?: boolean;
  onCropConfirmed: (croppedFile: File, previewUrl: string) => Promise<void> | void;
  onCancel?: () => void;
}

export function ImageCropperDialog({
  open,
  onOpenChange,
  imageSrc,
  title = "Crop Doctor Profile Photo",
  description = "Adjust and position your photo within the square frame for optimal website appearance.",
  aspect = 1, // 1:1 Square
  fileName = "doctor-photo.jpg",
  closeOnConfirm = true,
  onCropConfirmed,
  onCancel,
}: ImageCropperDialogProps) {
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Reset controls when a new image is loaded
  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setIsProcessing(false);
    }
  }, [open, imageSrc]);

  const onCropChange = (newCrop: Point) => {
    setCrop(newCrop);
  };

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const onCropCompleteCallback = React.useCallback(
    (_croppedArea: Area, currentCroppedAreaPixels: Area) => {
      setCroppedAreaPixels(currentCroppedAreaPixels);
    },
    []
  );

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const { file, objectUrl } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        fileName
      );
      await onCropConfirmed(file, objectUrl);
      if (closeOnConfirm !== false) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Failed to crop image:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    onOpenChange(false);
    if (onCancel) onCancel();
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="max-w-xl sm:max-w-2xl p-4 sm:p-5 gap-3 sm:gap-4 max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CropIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Cropper Work Area */}
        <div className="relative w-full h-[240px] sm:h-[280px] md:h-[310px] bg-black/95 rounded-lg overflow-hidden border border-border shadow-inner">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="rect"
            showGrid={true}
          />
        </div>

        {/* Adjustments & Controls */}
        <div className="space-y-4 pt-1">
          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ZoomIn className="h-3.5 w-3.5 text-primary" />
                Zoom
              </span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
                disabled={zoom <= 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                disabled={zoom >= 3}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom Action Bar: Rotate, Reset, and Navigation Guidance */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate}
                disabled={isProcessing}
                className="h-8 text-xs gap-1.5"
                title="Rotate 90 degrees clockwise"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rotate 90°
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isProcessing}
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                title="Reset zoom and rotation"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>

            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Drag photo to adjust position
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium min-w-[130px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Cropping & Saving...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Crop & Save Photo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
