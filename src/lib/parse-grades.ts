// Impor cepat komponen nilai: tempel banyak mata kuliah sekaligus dari teks bebas.
// Format: baris tanpa "%" dianggap header/nama mata kuliah baru, baris berisi "%" dianggap komponen nilai
// milik mata kuliah itu (nama komponen, lalu bobotnya). Baris kosong dilewati.
import { matchCourse } from "./course-aliases.ts";

export type ParsedComponent = { name: string; weightPercent: number };
export type ParsedBlock = {
  header: string; // teks header apa adanya, dipakai kalau perlu dipilih manual
  courseId: string | null; // hasil pencocokan otomatis; null kalau tidak ketemu
  components: ParsedComponent[];
};

const PERCENT = /(\d+(?:[.,]\d+)?)\s*%/;
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function parseGradeText(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const hasPercent = line.includes("%");
    const m = PERCENT.exec(line);
    if (!hasPercent) {
      // header baru: mata kuliah berikutnya
      blocks.push({ header: line.replace(/^[-•*]\s*/, ""), courseId: null, components: [] });
      continue;
    }
    if (!m) continue; // ada "%" tapi bobotnya tidak terbaca (mis. "UAS abc%"): lewati baris ini saja
    const weight = Number(m[1]!.replace(",", "."));
    const name = (line.slice(0, m.index) + line.slice(m.index + m[0].length))
      .replace(/^[-•*]\s*/, "")
      .replace(/[\s:.\-–—]+$/, "")
      .trim();
    if (!name || !Number.isFinite(weight) || weight <= 0) continue;
    if (blocks.length === 0)
      blocks.push({ header: "(tanpa nama)", courseId: null, components: [] }); // komponen sebelum ada header sama sekali
    blocks[blocks.length - 1]!.components.push({ name, weightPercent: Math.min(weight, 100) });
  }
  return blocks.filter((b) => b.components.length > 0);
}

// Cocokkan tiap header ke mata kuliah: lewat singkatan/kode yang sudah dikenal (matchCourse), lalu kecocokan
// nama secara longgar (dua arah, biar "VISKOM" cocok ke "Visi Komputer" dan sebaliknya).
export function matchBlocks<T extends { id: string; name: string; code: string; alias: string }>(
  blocks: ParsedBlock[],
  courses: T[],
): ParsedBlock[] {
  return blocks.map((b) => {
    const byAlias = matchCourse(b.header, courses);
    if (byAlias) return { ...b, courseId: byAlias.id };
    const h = norm(b.header);
    const byName = courses.find(
      (c) => h.includes(norm(c.name)) || norm(c.name).includes(h) || h === norm(c.code),
    );
    return { ...b, courseId: byName?.id ?? null };
  });
}
