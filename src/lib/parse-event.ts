// Membaca satu agenda dari kalimat bebas, mis. "rapat hima hari rabu jam 12.00 di sekre".
// Tanpa import selain parser tugas, supaya bisa dites langsung di Node.
import { findDate, findTime, tidyTitle, type Span } from "./parse-tasks.ts";

export type EventKind = "kegiatan" | "belajar" | "kuliah" | "praktikum";

export type ParsedEvent = {
  raw: string;
  title: string;
  start: Date | null;
  end: Date | null;
  location: string | null;
  kind: EventKind;
  timeGuessed: boolean; // hari ditulis tapi jam tidak
  durationGuessed: boolean; // durasi tidak ditulis
  looksLikeTask: boolean; // ada kata deadline/tugas/kumpul
  error?: string;
};

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const LEADING = /^(?:tolong\s+)?(?:jadwalkan|jadwal|catat|ingatkan|ingetin|tambah(?:kan)?|ada)\s+/i;
const RANGE =
  /(?<![\d/.-])(\d{1,2})[:.](\d{2})\s*(?:-|–|—|sampai|s\/d|sd|hingga)\s*(\d{1,2})[:.](\d{2})(?![\d:])/i;
const DURATION = /(?<![\d:.])(\d+(?:[.,]\d)?)\s*(jam|menit)\b/i;
const WEEKDAY = /\b(?:senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad)\b/i;
const SMALL = new Set(["di", "ke", "dan", "yang", "dari", "untuk", "dengan", "sama", "atau"]);
const DEFAULT_MINUTES = 60;

const blank = (s: string, a: Span) =>
  s.slice(0, a.start) + " ".repeat(a.end - a.start) + s.slice(a.end);

function titleCase(t: string) {
  // ada huruf besar (mis. "belajar ML"): pertahankan, hanya huruf pertama dibesarkan
  if (t !== t.toLowerCase()) return t.charAt(0).toUpperCase() + t.slice(1);
  return t
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function kindOf(text: string): EventKind {
  if (/\b(praktikum|lab)\b/i.test(text)) return "praktikum";
  if (/\b(kuliah|kelas)\b/i.test(text)) return "kuliah";
  if (/\b(belajar|review|latihan|baca|ngerjain|mengerjakan|nugas)\b/i.test(text)) return "belajar";
  return "kegiatan";
}

export function parseEvent(rawInput: string, now = new Date()): ParsedEvent | null {
  let line = rawInput
    .replace(INVISIBLE, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  line = line
    .replace(/^\s*(?:\d+\s*[.)]|[-*•])\s*/, "")
    .replace(LEADING, "")
    .trim();

  const base = {
    raw: rawInput.trim(),
    location: null as string | null,
    kind: kindOf(line),
    timeGuessed: false,
    durationGuessed: false,
    looksLikeTask: /\b(deadline|dl|tugas|kumpul(?:kan)?|due)\b/i.test(line),
  };
  const fail = (title: string, error: string): ParsedEvent => ({
    ...base,
    title,
    start: null,
    end: null,
    error,
  });

  // 1) tanggal, lalu jam (rentang, atau satu jam), lalu durasi, dicari di teks yang bagian sebelumnya sudah dikosongkan
  const dateHit = findDate(line, now, { allowToday: true });
  let masked = dateHit ? blank(line, dateHit) : line;

  let startH: number | null = null;
  let startM = 0;
  let endH: number | null = null;
  let endM = 0;
  const cuts: number[] = dateHit ? [dateHit.start] : [];

  const range = RANGE.exec(masked);
  if (range) {
    startH = Number(range[1]);
    startM = Number(range[2]);
    endH = Number(range[3]);
    endM = Number(range[4]);
    cuts.push(range.index);
    masked = blank(masked, { start: range.index, end: range.index + range[0].length });
  } else {
    const t = findTime(masked);
    if (t) {
      startH = t.h;
      startM = t.min;
      cuts.push(t.start);
      masked = blank(masked, t);
    }
  }
  if ((startH ?? 0) > 23 || startM > 59 || (endH ?? 0) > 23 || endM > 59)
    return fail(line, "Jamnya tidak valid.");

  let minutes = DEFAULT_MINUTES;
  let durationGuessed = true;
  const dur = DURATION.exec(masked);
  if (dur) {
    const n = Number(dur[1]!.replace(",", "."));
    minutes = Math.round(dur[2]!.toLowerCase() === "jam" ? n * 60 : n);
    durationGuessed = false;
    cuts.push(dur.index);
    masked = blank(masked, { start: dur.index, end: dur.index + dur[0].length });
    masked = masked.replace(/\bselama\b/gi, (m) => " ".repeat(m.length));
  }

  // 2) lokasi: "di sekretariat", "di aula fmipa"
  let location: string | null = null;
  const loc = /\bdi\s+(\S.*?)\s*$/i.exec(masked);
  if (loc) {
    location = loc[1]!.replace(/[,;.]+$/, "").trim() || null;
    if (location) cuts.push(loc.index);
  }

  // 3) judul: teks sebelum tanggal/jam/lokasi pertama
  let title = tidyTitle(cuts.length ? line.slice(0, Math.min(...cuts)) : line);
  if (!title) {
    let rest = masked;
    if (loc && location) rest = rest.slice(0, loc.index);
    title = tidyTitle(rest.replace(/\b(?:jam|pukul|pkl|pada|tanggal|tgl)\b\.?/gi, " "));
  }
  if (!title) return fail("", "Nama agenda tidak terbaca.");
  title = titleCase(title);

  // 4) susun waktu
  if (!dateHit && startH === null) {
    return fail(title, "Tulis harinya atau jamnya, mis. “rapat hima rabu jam 12.00”.");
  }
  if (dateHit && !dateHit.date) return fail(title, "Tanggalnya tidak valid.");

  let day = dateHit?.date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let timeGuessed = false;
  if (startH === null) {
    startH = 9;
    startM = 0;
    timeGuessed = true;
  }
  const at = (d: Date, h: number, m: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  let start = at(day, startH, startM);

  if (!dateHit && start <= now) {
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1); // jam hari ini sudah lewat: besok
    start = at(day, startH, startM);
  } else if (dateHit && WEEKDAY.test(line.slice(dateHit.start, dateHit.end)) && start <= now) {
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7); // "rabu" hari ini tapi jamnya lewat: rabu depan
    start = at(day, startH, startM);
  }

  let end = endH !== null ? at(day, endH, endM) : new Date(start.getTime() + minutes * 60000);
  if (end <= start) end = new Date(start.getTime() + minutes * 60000);
  if (endH !== null) durationGuessed = false;

  return { ...base, title, start, end, location, timeGuessed, durationGuessed };
}
