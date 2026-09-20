// Membaca daftar tugas dari teks bebas, mis.
//   1. SMA LKP 4, Deadline 20/09/2026, pukul 23:59‼️‼️
// Tanpa import supaya bisa dites langsung di Node.

export type ParsedTask = {
  raw: string;
  title: string;
  deadline: Date | null;
  urgent: boolean;
  timeGuessed: boolean; // jam tidak ditulis, dipakai 23.59
  error?: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  agus: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const KEYWORD =
  /\b(?:deadline(?:nya)?|dead\s*line|dl|due(?:\s*date)?|tenggat|batas(?:\s*waktu)?|dikumpul(?:kan)?|kumpul)\b/i;

// karakter tak terlihat yang ikut tersalin dari WhatsApp/Notes (mis. word joiner U+2060)
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

function clean(line: string) {
  return line
    .replace(INVISIBLE, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

type Span = { start: number; end: number };
type DateHit = Span & { date: Date | null };

function findDate(text: string, now: Date): DateHit | null {
  // 20/09/2026, 20-09-26, 20.09.2026 (tiga bagian, pemisah sama)
  let m = /(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})\2(\d{2}|\d{4})(?![\d/])/.exec(text);
  if (m) {
    const year = m[4]!.length === 2 ? 2000 + Number(m[4]) : Number(m[4]);
    return {
      start: m.index,
      end: m.index + m[0].length,
      date: validDate(year, Number(m[3]), Number(m[1])),
    };
  }

  // 22 Sep 2026, 22 September, 22 Sep
  for (const hit of text.matchAll(/(?<!\d)(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?/gi)) {
    const month = MONTHS[hit[2]!.toLowerCase()];
    if (!month) continue; // mis. "5 Deadline" bukan tanggal
    const year = hit[3] ? Number(hit[3]) : inferYear(now, month, Number(hit[1]));
    return {
      start: hit.index,
      end: hit.index + hit[0].length,
      date: validDate(year, month, Number(hit[1])),
    };
  }

  // 20/09 atau 20-09 (tanpa tahun; titik tidak dipakai karena bentrok dengan jam 23.59)
  m = /(?<![\d/.-])(\d{1,2})([/-])(\d{1,2})(?![\d/.-])/.exec(text);
  if (m) {
    const month = Number(m[3]);
    return {
      start: m.index,
      end: m.index + m[0].length,
      date: validDate(inferYear(now, month, Number(m[1])), month, Number(m[1])),
    };
  }

  // hari ini, besok, lusa
  m = /\b(hari\s+ini|besok|lusa)\b/i.exec(text);
  if (m) {
    const offset = /besok/i.test(m[1]!) ? 1 : /lusa/i.test(m[1]!) ? 2 : 0;
    return {
      start: m.index,
      end: m.index + m[0].length,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset),
    };
  }

  // nama hari: kejadian berikutnya (bukan hari ini)
  m = /\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad)\b/i.exec(text);
  if (m) {
    const target = WEEKDAYS[m[1]!.toLowerCase().replace("'", "")] ?? WEEKDAYS[m[1]!.toLowerCase()]!;
    const ahead = (target - now.getDay() + 7) % 7 || 7;
    return {
      start: m.index,
      end: m.index + m[0].length,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead),
    };
  }
  return null;
}

// Tanpa tahun: pakai tahun ini, kecuali tanggalnya sudah lewat jauh (lebih dari 30 hari), maka tahun depan.
function inferYear(now: Date, month: number, day: number) {
  const thisYear = validDate(now.getFullYear(), month, day);
  if (thisYear && now.getTime() - thisYear.getTime() > 30 * 864e5) return now.getFullYear() + 1;
  return now.getFullYear();
}

type TimeHit = Span & { h: number; min: number };

function findTime(text: string): TimeHit | null {
  // 23:59, 23.59, 9:30 (boleh didahului pukul / pukl / pkl / jam / jm / at)
  let m =
    /(?:\b(?:pu?k?u?l|pkl|jam|jm|at|pada)\b\.?\s*)?(?<![\d/.-])(\d{1,2})[:.](\d{2})(?![\d:])/i.exec(
      text,
    );
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (h === 24 && min === 0)
      return { start: m.index, end: m.index + m[0].length, h: 23, min: 59 };
    if (h > 23 || min > 59) return null;
    if (/\b(?:pm|malam|sore)\b/i.test(text) && h < 12) h += 12;
    return { start: m.index, end: m.index + m[0].length, h, min };
  }
  // jam 9, pukul 21
  m = /\b(?:pu?k?u?l|pkl|jam|jm)\b\.?\s*(\d{1,2})(?![\d:./-])/i.exec(text);
  if (m) {
    let h = Number(m[1]);
    if (h > 23) return null;
    if (/\b(?:pm|malam|sore)\b/i.test(text) && h < 12) h += 12;
    return { start: m.index, end: m.index + m[0].length, h, min: 0 };
  }
  return null;
}

function tidyTitle(s: string) {
  return s.replace(/^[\s,;:.\-–—|]+|[\s,;:\-–—|]+$/g, "").replace(/\s{2,}/g, " ");
}

export function parseTaskLine(rawLine: string, now = new Date()): ParsedTask | null {
  let line = clean(rawLine);
  if (!line) return null;

  const urgent = /[\u203C\u2757]|!{2,}/.test(line);
  line = line.replace(/(?:\u203C|\u2757|\u2755|!|\uFE0F)+/g, " ");
  line = line.replace(/^\s*(?:\d+\s*[.)]|[-*•]|\[\s?[xX ]?\s?\])\s*/, ""); // nomor urut atau butir
  line = line.replace(/\s+/g, " ").trim();
  if (!line) return null;

  const dateHit = findDate(line, now);
  // cari jam di teks yang tanggalnya sudah dibuang, supaya 20.09.2026 tidak terbaca sebagai jam
  const withoutDate = dateHit
    ? line.slice(0, dateHit.start) +
      " ".repeat(dateHit.end - dateHit.start) +
      line.slice(dateHit.end)
    : line;
  const timeHit = findTime(withoutDate);

  const cuts = [dateHit?.start, timeHit?.start, KEYWORD.exec(line)?.index].filter(
    (n): n is number => typeof n === "number",
  );
  let title = tidyTitle(cuts.length ? line.slice(0, Math.min(...cuts)) : line);

  if (!title) {
    // format terbalik: "Deadline 20/09 laporan SMA": buang tanggal, jam, dan kata kunci
    let rest = withoutDate;
    if (timeHit)
      rest =
        rest.slice(0, timeHit.start) +
        " ".repeat(timeHit.end - timeHit.start) +
        rest.slice(timeHit.end);
    rest = rest
      .replace(new RegExp(KEYWORD.source, "gi"), " ")
      .replace(/\b(?:pu?k?u?l|pkl|jam|jm|tanggal|tgl|pada|pm|malam|sore)\b\.?/gi, " ");
    title = tidyTitle(rest);
  }

  const base = { raw: rawLine.trim(), title, urgent, timeGuessed: !timeHit };
  if (!title) return { ...base, deadline: null, error: "Nama tugas tidak terbaca." };
  if (!dateHit)
    return {
      ...base,
      deadline: null,
      error: "Tanggal deadline tidak terbaca. Tulis mis. 20/09/2026.",
    };
  if (!dateHit.date) return { ...base, deadline: null, error: "Tanggalnya tidak valid." };

  const d = dateHit.date;
  const deadline = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    timeHit?.h ?? 23,
    timeHit?.min ?? 59,
  );
  return { ...base, deadline };
}

export function parseTasks(text: string, now = new Date()): ParsedTask[] {
  return text
    .split(/\r?\n/)
    .map((l) => parseTaskLine(l, now))
    .filter((t): t is ParsedTask => t !== null);
}
