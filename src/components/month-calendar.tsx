import { useState } from "react";
import { groupByDay, isSameMonth, monthGridDays } from "@/lib/calendar-month";
import { isSameDay, toneFor, type Course, type Schedule } from "@/lib/schedule-utils";

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MAX_SHOWN = 3;

// Kalender bulanan: geser (drag) sebuah agenda ke sel hari lain untuk memindah tanggalnya, jam dan durasi tetap sama.
// Geser hanya bekerja dengan mouse (drag-and-drop bawaan browser); di HP, buka agendanya lalu ubah tanggal di formnya.
export function MonthCalendar({
  cursor,
  items,
  courses,
  today,
  onOpen,
  onMove,
  busyId,
}: {
  cursor: Date; // tanggal 1 pada bulan yang ditampilkan
  items: Schedule[];
  courses: Course[];
  today: Date;
  onOpen: (s: Schedule) => void;
  onMove: (s: Schedule, newDay: Date) => void;
  busyId: string | null;
}) {
  const days = monthGridDays(cursor);
  const byDay = groupByDay(items, days);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<number | null>(null);

  return (
    <div className="min-w-[700px]">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="border-r border-border p-2 text-center text-xs font-bold uppercase text-muted-foreground last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 bg-grid">
        {days.map((day) => {
          const dayItems = byDay.get(day.getTime()) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const shown = dayItems.slice(0, MAX_SHOWN);
          const hidden = dayItems.length - shown.length;
          return (
            <div
              key={day.getTime()}
              onDragOver={(e) => {
                e.preventDefault();
                setOverDay(day.getTime());
              }}
              onDragLeave={() => setOverDay((v) => (v === day.getTime() ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setOverDay(null);
                const id = e.dataTransfer.getData("text/schedule-id");
                const s = items.find((x) => x.id === id);
                if (s) onMove(s, day);
              }}
              className={`min-h-24 border-b border-r border-border p-1.5 last:border-r-0 ${inMonth ? "" : "bg-muted/40"} ${overDay === day.getTime() ? "bg-secondary" : ""}`}
            >
              <p
                className={`text-xs font-bold ${isToday ? "grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"}`}
              >
                {day.getDate()}
              </p>
              <div className="mt-1 grid gap-1">
                {shown.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    draggable={!s.google_event_id || s.activity_type !== "tugas"}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/schedule-id", s.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(s.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onOpen(s)}
                    title={s.title}
                    aria-label={`${s.title}, ${new Date(s.starts_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
                    className={`tone-${toneFor(s, courses)} block w-full cursor-grab truncate rounded px-1.5 py-0.5 text-left text-[.68rem] font-semibold leading-tight active:cursor-grabbing ${dragId === s.id || busyId === s.id ? "opacity-40" : ""} ${s.done ? "line-through opacity-60" : ""}`}
                  >
                    {s.title}
                  </button>
                ))}
                {hidden > 0 && (
                  <p className="px-1.5 text-[.65rem] font-semibold text-muted-foreground">
                    +{hidden} lagi
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
