// Singkatan mata kuliah, supaya "SMA LKP 4" atau "CV LKP 5" langsung dikenali.
type CourseLike = { id: string; name: string; code: string; alias: string };

// Singkatan yang lazim dipakai (termasuk nama Inggrisnya).
const KNOWN: Record<string, string[]> = {
  "sistem multi-agen": ["SMA", "MAS"],
  "human-ai interaction": ["HAI", "HAII", "HCI"],
  "pembelajaran mesin": ["ML", "PM"],
  "perancangan produk kecerdasan buatan": ["PPKA", "PPAI"],
  "visi komputer": ["CV", "VK"],
  "sistem tertanam dan robotika": ["STR", "ESR"],
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function defaultAliases(name: string): string[] {
  const known = KNOWN[norm(name)] ?? [];
  const initials = name
    .split(/[\s-]+/)
    .filter((w) => w && !/^(dan|&|of|the)$/i.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return [...new Set([...known, ...(initials.length >= 2 ? [initials] : [])])];
}

export const parseAliases = (alias: string) =>
  alias
    .split(/[,;\n]+/)
    .map((a) => a.trim().toUpperCase())
    .filter(Boolean);

// Cari mata kuliah dari judul tugas: singkatan, kode (KEB1412), atau nama lengkap.
export function matchCourse<T extends CourseLike>(title: string, courses: T[]): T | null {
  const tokens = title
    .toUpperCase()
    .split(/[\s,;:/()]+/)
    .filter(Boolean);
  const lower = title.toLowerCase();
  let best: { course: T; at: number } | null = null;
  for (const c of courses) {
    const keys = new Set([...parseAliases(c.alias), c.code.toUpperCase()]);
    let at = tokens.findIndex((t) => keys.has(t));
    if (at < 0 && lower.includes(norm(c.name))) at = 0;
    if (at >= 0 && (!best || at < best.at)) best = { course: c, at };
  }
  return best?.course ?? null;
}
