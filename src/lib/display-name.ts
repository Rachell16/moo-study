// Nama panggilan untuk sapaan: pilihan pengguna dulu, lalu nama dari akun Google, lalu awalan email.
type UserLike =
  | { email?: string | undefined; user_metadata?: Record<string, unknown> | undefined }
  | null
  | undefined;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function displayNameOf(user: UserLike): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};

  const chosen = str(meta["display_name"]); // diisi sendiri lewat "Ganti nama panggilan"
  if (chosen) return chosen;

  const full = str(meta["full_name"]) || str(meta["name"]); // dari login Google: ambil nama depan
  if (full) return full.split(/\s+/)[0]!;

  const local = (user.email ?? "").split("@")[0] ?? "";
  const word =
    local
      .replace(/[._+-]+/g, " ")
      .replace(/\d+/g, " ")
      .trim()
      .split(/\s+/)[0] ?? "";
  return word.length >= 3 ? cap(word) : ""; // "r.tobing@..." bukan nama yang layak untuk sapaan
}
