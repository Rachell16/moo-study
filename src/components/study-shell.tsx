import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  GraduationCap,
  Home,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CowMark } from "@/components/cow-mark";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { THEME_LABEL } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/belajar", label: "Belajar", icon: Sparkles },
  { to: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { to: "/tugas", label: "Tugas", icon: ListChecks },
  { to: "/ujian", label: "Ujian", icon: GraduationCap },
  { to: "/materi", label: "Materi", icon: BookOpen },
  { to: "/timer", label: "Timer", icon: Clock3 },
] as const;

export function StudyShell({
  children,
  title,
  kicker,
}: {
  children: ReactNode;
  title: string;
  kicker: string;
}) {
  const [open, setOpen] = useState(false);
  // Sidebar bisa ditutup di layar besar supaya materi (PDF, poin) kelihatan lebih lega. Pilihan ini diingat di browser.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(window.localStorage.getItem("moo-sidebar-collapsed") === "1"), []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("moo-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* abaikan */
      }
      return next;
    });
  };
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { loading, userId } = useSession();
  const navigate = useNavigate();
  const theme = useTheme();
  const ThemeIcon = theme.theme === "dark" ? Moon : theme.theme === "light" ? Sun : Monitor;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 print:hidden flex-col border-r border-border bg-sidebar px-4 py-5 transition-transform ${collapsed ? "md:-translate-x-full" : "md:translate-x-0"} ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <CowMark className="h-11 w-11" />
            <div>
              <p className="font-display text-xl font-bold leading-none">Moo Study</p>
              <p className="mt-1 text-xs text-muted-foreground">my little study barn</p>
            </div>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <X />
          </Button>
        </div>
        <div className="my-6 h-px bg-border" />
        <nav className="space-y-2" aria-label="Navigasi utama">
          {nav.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-2 w-2 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-md border border-border bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Catatan hari ini
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pelan-pelan asal konsisten. Kamu nggak harus menyelesaikan semuanya hari ini.
          </p>
        </div>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-foreground/20 md:hidden print:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        />
      )}
      <div
        className={`min-h-screen print:pl-0 transition-[padding] ${collapsed ? "md:pl-0" : "md:pl-64"}`}
      >
        <header className="sticky top-0 z-20 flex min-h-20 print:hidden items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <Button
            size="icon"
            variant="outline"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <Menu />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={theme.cycle}
            aria-label={`Tema: ${THEME_LABEL[theme.theme]}. Klik untuk ganti.`}
            title={`Tema: ${THEME_LABEL[theme.theme]}`}
          >
            <ThemeIcon />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="hidden md:inline-flex"
            onClick={toggleCollapsed}
            aria-label={
              collapsed ? "Tampilkan menu" : "Sembunyikan menu, biar materinya lebih lega"
            }
            title={collapsed ? "Tampilkan menu" : "Sembunyikan menu"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{kicker}</p>
            <h1 className="font-display truncate text-2xl font-bold md:text-3xl">{title}</h1>
          </div>
          {loading ? null : userId ? (
            <Button
              variant="outline"
              aria-label="Keluar"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/" });
              }}
            >
              <LogOut /> <span className="hidden sm:inline">Keluar</span>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/auth">
                <LogIn /> Masuk
              </Link>
            </Button>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PaperCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`paper-card ${className}`}>{children}</section>;
}
