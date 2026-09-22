// Mengecilkan foto di browser sebelum dikirim ke AI: lebih hemat jatah, lebih cepat diunggah, dan cukup untuk dibaca teksnya.
export async function resizeImageToJpeg(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser ini tidak bisa mengubah ukuran foto.");
  ctx.fillStyle = "#ffffff"; // dasar putih untuk foto PNG transparan
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Gagal memproses foto.");
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { base64: btoa(bin), mimeType: "image/jpeg" };
}
