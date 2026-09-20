import { sessionTitle, type ClassSession } from "./parse-timetable.ts";
import { addDays } from "./schedule-utils.ts";

// Ubah kelas mingguan menjadi baris `schedules`: tiap kelas diulang `weeks` minggu mulai dari Senin `monday`.
export function buildTimetableRows(
  sessions: ClassSession[],
  opts: { userId: string; monday: Date; weeks: number; courseIdByCode: Map<string, string> },
) {
  return sessions.flatMap((s) => {
    const [sh, sm] = s.start.split(":").map(Number) as [number, number];
    const [eh, em] = s.end.split(":").map(Number) as [number, number];
    return Array.from({ length: opts.weeks }, (_, w) => {
      const day = addDays(opts.monday, s.day - 1 + 7 * w);
      const at = (h: number, m: number) =>
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
      return {
        user_id: opts.userId,
        course_id: (s.code && opts.courseIdByCode.get(s.code)) || null,
        title: sessionTitle(s),
        activity_type: s.kind === "P" ? "praktikum" : "kuliah",
        starts_at: at(sh, sm),
        ends_at: at(eh, em),
        location: s.room || null,
        notes: s.pj ? `PJ: ${s.pj}` : null,
        sync_status: "lokal",
      };
    });
  });
}
