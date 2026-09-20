import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CowMark } from "@/components/cow-mark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — Moo Study" },
      { name: "description", content: "Masuk ke ruang belajar pribadi Moo Study." },
      { property: "og:title", content: "Masuk — Moo Study" },
      { property: "og:description", content: "Masuk ke ruang belajar pribadi Moo Study." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // pesan dari Supabase dibuat lebih mudah dimengerti
  const friendly = (m: string) =>
    /invalid login/i.test(m)
      ? "Email atau kata sandi salah."
      : /rate limit/i.test(m)
        ? "Terlalu banyak email terkirim dalam waktu singkat. Tunggu sebentar lalu coba lagi."
        : /already registered/i.test(m)
          ? "Email ini sudah terdaftar. Coba klik Masuk."
          : m;

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(friendly(error.message));
    void navigate({ to: "/" });
  };

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setMessage(friendly(error.message));
    if (data.session)
      void navigate({ to: "/" }); // konfirmasi email dimatikan: langsung masuk
    else setMessage("Cek email untuk mengonfirmasi akunmu.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-checker p-5">
      <section className="w-full max-w-md rounded-md border border-border bg-card p-7 shadow-xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <CowMark className="mx-auto h-20 w-20" />
        <h1 className="mt-4 text-center font-display text-3xl font-bold">
          Masuk ke kandang belajar
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Jadwal dan materi tetap privat untukmu.
        </p>
        <div className="mt-7 space-y-3">
          <input
            className="field w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className="field w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kata sandi"
          />
          <Button className="w-full" onClick={() => void signIn()}>
            Masuk
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void signUp()}>
            Buat akun
          </Button>
          <div className="flex items-center gap-3 py-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">atau</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              void supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin },
              })
            }
          >
            Lanjutkan dengan Google
          </Button>
          {message && <p className="text-center text-sm font-medium text-primary">{message}</p>}
        </div>
      </section>
    </main>
  );
}
