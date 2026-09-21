import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock3, MapPin, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { WelcomeScreen } from "@/components/welcome-screen";
import { NameDialog } from "@/components/name-dialog";
import { PlanCard } from "@/components/plan-card";
import cowMascot from "@/assets/cow-mascot.png";
import {
  useCourses,
  useExams,
  useMaterials,
  useSchedulesBetween,
  useTasks,
} from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { fmtSize } from "@/lib/materials";
import {
  ACTIVITY_TYPES,
  addDays,
  countdownLabel,
  fmtTime,
  startOfDay,
  type Schedule,
} from "@/lib/schedule-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Moo Study — Ruang Belajar Pribadi" },
      {
        name: "description",
        content: "Dashboard pribadi untuk jadwal kuliah, materi, dan waktu fokus.",
      },
      { property: "og:title", content: "Moo Study — Ruang Belajar Pribadi" },
      {
        property: "og:description",
        content: "Dashboard pribadi untuk jadwal kuliah, materi, dan waktu fokus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function greetingFor(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function Index() {
  const { loading, userId, name: userName } = useSession();
  const [nameOpen, setNameOpen] = useState(false);
  // Tanggal dan salam dihitung setelah tampil di browser supaya tidak beda dengan hasil render server.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const dayStart = useMemo(() => startOfDay(now ?? new Date(0)), [now]);

  const today = useSchedulesBetween(now ? userId : null, dayStart, addDays(dayStart, 1));
  const tasks = useTasks(userId);
  const exams = useExams(userId);
  const materials = useMaterials(userId);
  const courses = useCourses(userId);

  const list = today.data ?? [];
  const classes = list.filter(
    (x) => x.activity_type === "kuliah" || x.activity_type === "praktikum",
  ).length;
  const study = list.filter((x) => x.activity_type === "belajar").length;
  const others = list.filter((x) => x.activity_type === "kegiatan").length;
  const summary = !userId
    ? "Masuk untuk melihat agendamu hari ini."
    : list.length === 0
      ? "Belum ada agenda hari ini. Santai dulu, atau jadwalkan satu sesi belajar ringan."
      : `Hari ini ada ${classes} kelas dan ${study} sesi belajar${others ? `, plus ${others} kegiatan lain` : ""}. Mulai dari yang paling ringan, ya.`;

  // Tugas belum selesai dan ujian yang akan datang, digabung dan diurutkan dari yang paling dekat.
  const upcoming = useMemo(() => {
    const t = new Date();
    const items = [
      ...(tasks.data ?? [])
        .filter((x) => !x.done && new Date(x.ends_at).getTime() > t.getTime() - 24 * 36e5)
        .map((x) => ({
          id: x.id,
          kind: "Tugas",
          title: x.title,
          at: new Date(x.ends_at),
          to: "/tugas" as const,
          urgent: x.urgent,
        })),
      ...(exams.data ?? [])
        .filter((x) => new Date(x.ends_at) >= t)
        .map((x) => ({
          id: x.id,
          kind: (x.exam_kind ?? "ujian").toUpperCase(),
          title: x.title,
          at: new Date(x.starts_at),
          to: "/ujian" as const,
          urgent: false,
        })),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 4);
  }, [tasks.data, exams.data]);

  const recent = (materials.data ?? []).slice(0, 2);
  const courseName = (id: string | null) =>
    courses.data?.find((c) => c.id === id)?.name ?? "Belum dikategorikan";

  // Belum masuk: tampilkan layar selamat datang. Saat sesi masih diperiksa, tampilkan latar yang sama supaya tidak berkedip.
  if (loading) return <div className="pasture min-h-screen" />;
  if (!userId) return <WelcomeScreen />;

  return (
    <StudyShell
      title={`${now ? greetingFor(now.getHours()) : "Halo"}${userName ? `, ${userName}` : ""}!`}
      kicker={
        now
          ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
          : "Hari ini"
      }
    >
      <section className="hero-band relative mb-6 overflow-hidden rounded-md border border-border px-6 py-7 md:px-9">
        <div className="relative z-10 max-w-xl">
          <span className="tag bg-accent text-accent-foreground">
            <Sparkles className="h-3 w-3" /> Fokus hari ini
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">
            Satu langkah kecil,
            <br />
            satu halaman lagi.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <Button asChild className="mt-5">
            <Link to="/timer">
              <Clock3 /> Mulai fokus <ArrowRight />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setNameOpen(true)}
            className="mt-3 block text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Ganti nama panggilan
          </button>
        </div>
        <img
          src={cowMascot}
          width={1024}
          height={1024}
          alt="Sapi lucu memakai topi koboi merah muda"
          className="absolute -bottom-16 -right-10 w-56 rotate-[-3deg] md:-bottom-24 md:right-6 md:w-80"
        />
      </section>

      <PlanCard userId={userId} limit={3} className="mb-5" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)]">
        <PaperCard>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="section-kicker">Agenda hari ini</p>
              <h2 className="font-display text-2xl font-bold">Berikutnya di kandang</h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/jadwal">
                Lihat jadwal <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {userId
                  ? "Tidak ada agenda hari ini."
                  : "Belum masuk. Agenda hari ini akan muncul di sini."}
              </p>
            ) : (
              list.map((item) => (
                <Agenda
                  key={item.id}
                  time={fmtTime(new Date(item.starts_at))}
                  title={item.title}
                  detail={`${item.location ?? "Belum ada lokasi"} · hingga ${fmtTime(new Date(item.ends_at))}`}
                  tone={toneClass(item)}
                  tag={
                    item.activity_type === "kuliah" || item.activity_type === "praktikum"
                      ? tagLabel(item)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </PaperCard>

        <PaperCard className="bg-study-pink">
          <p className="section-kicker">Yang mendekat</p>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm">
              {userId
                ? "Tidak ada deadline atau ujian dalam waktu dekat."
                : "Masuk untuk melihat tugas dan ujianmu."}
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
              {upcoming.map((u) => {
                const cd = countdownLabel(u.at, now ?? new Date());
                return (
                  <li key={u.id}>
                    <Link to={u.to} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-display font-bold">
                          {u.title}
                          {u.urgent && " ‼️"}
                        </span>
                        <span className="text-xs text-muted-foreground">{u.kind}</span>
                      </span>
                      <span
                        className={`tag shrink-0 ${cd.late ? "bg-destructive text-destructive-foreground" : "bg-background/70"}`}
                      >
                        {cd.text}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PaperCard>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3">
        <PaperCard className="md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Baru diunggah</p>
              <h2 className="font-display text-xl font-bold">Materi terakhir</h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/materi">
                <BookOpen /> Semua materi
              </Link>
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {userId
                  ? "Belum ada materi. Unggah PDF atau slide pertamamu."
                  : "Masuk untuk melihat materimu."}
              </p>
            ) : (
              recent.map((m) => (
                <MiniFile
                  key={m.id}
                  type={m.file_type === "pdf" ? "PDF" : "PPT"}
                  title={m.name}
                  detail={`${courseName(m.course_id)} · ${fmtSize(m.size_bytes)}`}
                />
              ))
            )}
          </div>
        </PaperCard>
        <PaperCard className="cow-pattern">
          <p className="section-kicker">Semangat!</p>
          <p className="mt-3 font-display text-2xl font-bold leading-snug">
            “Belajar dulu, rebahan kemudian.”
          </p>
          <p className="mt-4 text-sm font-semibold text-primary">— si sapi rajin</p>
        </PaperCard>
      </div>
      <NameDialog open={nameOpen} onOpenChange={setNameOpen} current={userName} />
    </StudyShell>
  );
}

function Agenda({
  time,
  title,
  detail,
  tone,
  tag,
}: {
  time: string;
  title: string;
  detail: string;
  tone: string;
  tag?: string | undefined;
}) {
  return (
    <article className="agenda-row">
      <time>{time}</time>
      <span className={`agenda-dot ${tone}`} />
      <div>
        <h3>{title}</h3>
        <p>
          <MapPin /> {detail}
        </p>
      </div>
      {tag && <span className="tag ml-auto">{tag}</span>}
    </article>
  );
}

function MiniFile({ type, title, detail }: { type: string; title: string; detail: string }) {
  return (
    <div className="mini-file">
      <span>{type}</span>
      <div className="min-w-0">
        <b className="block truncate">{title}</b>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function toneClass(item: Schedule) {
  return item.activity_type === "praktikum"
    ? "bg-destructive"
    : item.activity_type === "kuliah"
      ? "bg-primary"
      : "bg-accent";
}

function tagLabel(item: Schedule) {
  return ACTIVITY_TYPES.find((t) => t.value === item.activity_type)?.label ?? item.activity_type;
}
