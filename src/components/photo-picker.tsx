import { Camera, ImagePlus } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { shrinkPhoto } from "@/lib/photo";
import { PHOTOS_ENABLED } from "@/lib/photos-flag";

export function PhotoPicker({
  onPick,
  label,
  bare = false,
}: {
  onPick: (dataUrl: string) => void;
  label?: string;
  bare?: boolean;
}) {
  if (!PHOTOS_ENABLED) return null;
  const { t } = useI18n();
  const galleryId = useId();
  const cameraId = useId();

  function take(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("photo.fail"));
      return;
    }
    void shrinkPhoto(file).then((data) => {
      if (!data) toast.error(t("photo.fail"));
      else onPick(data);
    });
  }

  const inputs = (
    <>
      <input
        id={galleryId}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,image/*"
        className="sr-only"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  if (bare) {
    return (
      <div className="flex gap-2">
        {inputs}
        <label htmlFor={galleryId} aria-label={t("photo.gallery")} className="grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-fg shadow-card">
          <ImagePlus className="size-5" />
        </label>
        <label htmlFor={cameraId} aria-label={t("photo.camera")} className="grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-fg shadow-card">
          <Camera className="size-5" />
        </label>
      </div>
    );
  }

  return (
    <div>
      {label ? <p className="mb-2 text-sm font-medium">{label}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {inputs}
        <Button asChild variant="outline" className="w-full">
          <label htmlFor={galleryId}>
            <ImagePlus />
            {t("photo.gallery")}
          </label>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <label htmlFor={cameraId}>
            <Camera />
            {t("photo.camera")}
          </label>
        </Button>
      </div>
    </div>
  );
}
