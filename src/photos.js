function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const maxEdge = 1600;
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        let quality = 0.72;
        let blob = await toBlob(canvas, quality);
        while (blob && blob.size > 1_500_000 && quality > 0.45) {
          quality -= 0.08;
          blob = await toBlob(canvas, quality);
        }
        if (!blob) throw new Error("No se pudo comprimir la foto");
        if (blob.size > 2_000_000) throw new Error("La foto sigue siendo muy pesada. Probá con otra.");
        resolve(new File([blob], "foto.jpg", { type: "image/jpeg" }));
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error instanceof Error ? error : new Error("No se pudo comprimir la foto"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Tu navegador no pudo leer esa foto. Probá con JPG."));
    };
    img.src = url;
  });
}

export function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la foto"));
    reader.readAsDataURL(file);
  });
}
