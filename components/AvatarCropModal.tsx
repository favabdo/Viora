"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { X, ZoomIn } from "lucide-react";
import { getCroppedImageBlob } from "@/lib/cropImage";

export default function AvatarCropModal({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError("");
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setError("تعذّر قصّ الصورة، يُرجى المحاولة مرة أخرى");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/45 flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-paper border border-line rounded-lg shadow-modal max-w-sm w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-medium">اقتصاص الصورة</h3>
          <IconButton aria-label="إغلاق" onClick={onCancel}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="relative w-full h-64 bg-paperDark rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-2.5 mt-4">
          <ZoomIn size={15} strokeWidth={1.75} className="text-inkFaint shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-teal"
            aria-label="التكبير"
          />
        </div>

        {error && <p className="text-clay text-xs mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={saving}>
            إلغاء
          </Button>
          <Button variant="primary" fullWidth loading={saving} onClick={handleConfirm}>
            حفظ الصورة
          </Button>
        </div>
      </div>
    </div>
  );
}
