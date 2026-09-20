import { supabase } from "@/integrations/supabase/client";
import type { Material } from "@/lib/schedule-utils";

export const BUCKET = "study-materials";

// Buka file di tab baru lewat tautan sementara (bucket bersifat privat).
export async function openMaterial(m: Pick<Material, "storage_path">) {
  const tab = window.open("about:blank", "_blank"); // dibuka dulu agar tidak diblokir browser
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.storage_path, 300);
  if (error || !data) {
    tab?.close();
    throw new Error(error?.message ?? "File tidak ditemukan.");
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else window.location.href = data.signedUrl;
}

export const isReviewed = (m: Pick<Material, "reviewed_at">) => m.reviewed_at !== null;

export async function setReviewed(id: string, reviewed: boolean) {
  const { error } = await supabase
    .from("materials")
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Hapus baris dulu, lalu file-nya. Kalau file gagal terhapus, yang tersisa cuma file yatim yang tidak terlihat.
export async function deleteMaterial(m: Pick<Material, "id" | "storage_path">) {
  const { error } = await supabase.from("materials").delete().eq("id", m.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([m.storage_path]);
}
