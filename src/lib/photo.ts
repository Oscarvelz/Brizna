/** Shrink a photo before it is stored. Optional, not an album. */
export function shrinkPhoto(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const paint = (max: number, quality: number) => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", quality);
      };
      let data = paint(640, 0.62);
      if (data && data.length > 170_000) data = paint(640, 0.45);
      if (data && data.length > 170_000) data = paint(480, 0.4);
      if (data && data.length > 170_000) data = paint(360, 0.38);
      resolve(data && data.length <= 180_000 ? data : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
