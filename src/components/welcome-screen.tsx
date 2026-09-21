import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CowMark } from "@/components/cow-mark";
import cowMascot from "@/assets/cow-mascot.png";

function Star({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.8 4.5 6.4 4.5c2.1 0 3.9 1.1 5.6 3.2 1.7-2.1 3.5-3.2 5.6-3.2 3.6 0 5.5 3.8 4 7.2C19.5 16.4 12 21 12 21z"
        fill="currentColor"
      />
    </svg>
  );
}

const cards = [
  {
    label: "jadwal cow",
    text: "Jadwal kuliah dan praktikum sekali impor, tersambung ke Google Calendar.",
    pattern: "pat-stars",
    icon: CalendarDays,
    tilt: "-rotate-1",
  },
  {
    label: "tugas cow",
    text: "Tempel daftar tugas, deadline terbaca sendiri dan langsung masuk jadwal.",
    pattern: "pat-check",
    icon: ListChecks,
    tilt: "rotate-1",
  },
  {
    label: "ujian cow",
    text: "Hitung mundur UTS dan UAS, plus materi mana yang belum di-review.",
    pattern: "pat-flowers",
    icon: GraduationCap,
    tilt: "-rotate-1",
  },
  {
    label: "materi cow",
    text: "PDF dan slide rapi per mata kuliah, dipisah kuliah dan praktikum.",
    pattern: "pat-spots",
    icon: BookOpen,
    tilt: "rotate-1",
  },
] as const;

export function WelcomeScreen() {
  return (
    <div className="pasture min-h-screen px-4 pb-10 pt-5 text-card md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <CowMark className="h-11 w-11" />
            <span className="font-display text-xl font-bold">Moo Study</span>
          </Link>
          <Button asChild variant="secondary">
            <Link to="/auth">Masuk</Link>
          </Button>
        </header>

        <main>
          <section className="poster text-foreground">
            <div className="checker-strip" />
            <div className="grid items-center gap-6 px-6 py-8 md:grid-cols-[1.1fr_.9fr] md:px-12 md:py-12">
              <div>
                <p className="font-hand inline-block -rotate-2 rounded-full bg-study-pink px-4 py-0.5 text-2xl font-bold">
                  halo, sapi rajin!
                </p>
                <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] md:text-6xl">
                  Selamat datang di kandang belajar
                </h1>
                <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                  Tempat menyimpan jadwal kuliah, tugas, dan materi supaya tidak
                  ada yang kelewat. Pelan-pelan asal konsisten.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link to="/auth">Masuk ke kandang</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/auth">Buat akun</Link>
                  </Button>
                </div>
                <p className="font-hand mt-3 text-xl text-muted-foreground">
                  gratis, dan datamu cuma bisa dibuka olehmu
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-sm md:max-w-none">
                <div
                  className="absolute inset-x-6 bottom-4 top-8 rounded-[45%] bg-study-pink/70"
                  aria-hidden="true"
                />
                <Star className="absolute left-2 top-4 h-9 w-9 rotate-[-12deg] text-destructive" />
                <Star className="absolute bottom-10 right-3 h-7 w-7 rotate-12 text-destructive" />
                <Heart className="absolute bottom-3 left-8 h-7 w-7 -rotate-6 text-destructive" />
                <img
                  src={cowMascot}
                  width={1024}
                  height={1024}
                  alt="Sapi lucu memakai topi koboi merah muda dan bandana merah"
                  className="mascot-in relative mx-auto w-full max-w-[420px]"
                />
                <div className="font-hand absolute right-[48%] top-1 max-w-[9.5rem] -rotate-3 rounded-2xl border-2 border-foreground bg-card px-3 py-1.5 text-center text-xl font-bold leading-tight">
                  moooo~ jadwalmu aman di sini!
                  <span
                    className="absolute -bottom-[9px] right-5 h-4 w-4 rotate-45 border-b-2 border-r-2 border-foreground bg-card"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Isi kandang" className="mt-10">
            <h2 className="font-hand mb-4 text-3xl font-bold">
              isi kandangnya
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(({ label, text, pattern, icon: Icon, tilt }) => (
                <article
                  key={label}
                  className={`sticker poster text-foreground ${tilt}`}
                >
                  <div
                    className={`${pattern} h-20 border-b-2 border-foreground`}
                  />
                  <div className="p-4">
                    <p className="font-hand flex items-center gap-2 text-2xl font-bold">
                      <Icon className="h-5 w-5 text-primary" /> {label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="font-hand mt-10 text-center text-xl opacity-90">
          dibuat dengan banyak rumput dan sedikit moooo~
        </footer>
      </div>
    </div>
  );
}
