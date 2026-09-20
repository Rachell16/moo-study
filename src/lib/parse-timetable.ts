// Membaca jadwal kuliah dari teks yang biasa dibagikan lewat chat:
//   *HARI SENIN*
//   *10:00 - 11:40*
//   Mata Kuliah: KEB1316 Sistem Multi-Agen (K/1)
//   Ruangan: IPB W8 502
//   PJ: Danish
// Tanpa import supaya bisa dites langsung di Node.

export type ClassSession = {
  day: number; // 1 = Senin ... 7 = Minggu
  start: string; // "10:00"
  end: string;
  code: string;
  name: string;
  kind: "K" | "P"; // K = kuliah, P = praktikum
  section: string; // "1" dari (K/1)
  room: string;
  pj: string;
};

export type TimetableResult = { sessions: ClassSession[]; notes: string[]; warnings: string[] };

const DAYS: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
  minggu: 7,
  ahad: 7,
};
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

const pad = (n: string) => n.padStart(2, "0");

export function parseTimetable(text: string): TimetableResult {
  const sessions: ClassSession[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  let day = 0;
  let start = "";
  let end = "";
  let current: ClassSession | null = null;
  let inNotes = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(INVISIBLE, "")
      .replace(/\u00A0/g, " ")
      .replace(/[*_~`]/g, "")
      .trim();
    if (!line || /^[-–—=_\s]{3,}$/.test(line)) continue;

    if (/^catatan\s*:?/i.test(line)) {
      inNotes = true;
      const rest = line.replace(/^catatan\s*:?/i, "").trim();
      if (rest) notes.push(rest);
      continue;
    }
    if (inNotes) {
      notes.push(line);
      continue;
    }

    const dayMatch = /^hari\s+([a-z']+)/i.exec(line);
    if (dayMatch) {
      const d = DAYS[dayMatch[1]!.toLowerCase().replace(/’/g, "'")];
      if (d) {
        day = d;
        start = end = "";
        current = null;
      } else warnings.push(`Nama hari tidak dikenal: "${line}"`);
      continue;
    }

    const time = /^(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})$/.exec(line);
    if (time) {
      start = `${pad(time[1]!)}:${time[2]}`;
      end = `${pad(time[3]!)}:${time[4]}`;
      current = null;
      continue;
    }

    const course = /^mata\s*kuliah\s*:\s*(.+)$/i.exec(line);
    if (course) {
      const body = course[1]!.trim();
      const m =
        /^(?:([A-Za-z]{2,6}\s?\d{3,4})\s+)?(.+?)\s*\(\s*([KkPp])\s*\/\s*(\d+)\s*\)\s*$/.exec(body);
      if (!day || !start) {
        warnings.push(`"${body}" tidak punya hari atau jam di atasnya, dilewati.`);
        current = null;
        continue;
      }
      current = {
        day,
        start,
        end,
        code: (m?.[1] ?? "").replace(/\s/g, "").toUpperCase(),
        name: (m?.[2] ?? body).trim(),
        kind: (m?.[3] ?? "K").toUpperCase() === "P" ? "P" : "K",
        section: m?.[4] ?? "",
        room: "",
        pj: "",
      };
      if (!m) warnings.push(`Kelas "${body}" tidak ada penanda (K/1) atau (P/1), dianggap kuliah.`);
      sessions.push(current);
      continue;
    }

    const room = /^ruang(?:an)?\s*:\s*(.*)$/i.exec(line);
    if (room && current) {
      current.room = room[1]!.trim();
      continue;
    }
    const pj = /^pj\s*:\s*(.*)$/i.exec(line);
    if (pj && current) {
      current.pj = pj[1]!.trim();
      continue;
    }
  }
  return { sessions, notes, warnings };
}

// Kuliah (K) selalu dicentang. Praktikum yang punya beberapa kelas: hanya kelas dengan nomor terkecil.
export function defaultSelection(sessions: ClassSession[]): boolean[] {
  const firstP = new Map<string, number>();
  for (const s of sessions) {
    if (s.kind !== "P") continue;
    const n = Number(s.section) || 0;
    const key = s.code || s.name;
    if (!firstP.has(key) || n < firstP.get(key)!) firstP.set(key, n);
  }
  return sessions.map(
    (s) => s.kind === "K" || (Number(s.section) || 0) === firstP.get(s.code || s.name),
  );
}

export const sessionTitle = (s: ClassSession) =>
  s.section ? `${s.name} (${s.kind}/${s.section})` : s.name;
