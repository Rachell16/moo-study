import { Link } from "@tanstack/react-router";
import { Bell, Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CowBuddy, type CowMood } from "@/components/cow-buddy";
import { PaperCard } from "@/components/study-shell";
import { useCompanion } from "@/hooks/use-companion";
import { IDLE_CHOICES } from "@/lib/companion";

const MOODS: { mood: CowMood; label: string }[] = [
  { mood: "senang", label: "Santai" },
  { mood: "fokus", label: "Fokus" },
  { mood: "istirahat", label: "Istirahat" },
  { mood: "semangat", label: "Hore" },
  { mood: "ingat", label: "Mengingatkan" },
  { mood: "tidur", label: "Tidur" },
];

// Pengaturan teman belajar: nama sapi, jenis pengingat, notifikasi, dan pasang di layar utama.
export function CompanionSettings() {
  const cow = useCompanion();
  const [name, setName] = useState(cow.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(cow.name), [cow.name]);

  const save = async () => {
    setSaving(true);
    const error = await cow.setName(name);
    setSaving(false);
    if (error) toast.error(error);
    else toast.success(`Sapinya sekarang bernama ${name.trim() || "Moo"}.`);
  };

  const toggleNotify = async (on: boolean) => {
    if (!on) return cow.updateSettings({ notify: false });
    if (cow.permission === "unsupported")
      return void toast.error("Browser ini belum mendukung notifikasi.");
    const p = cow.permission === "granted" ? "granted" : await cow.requestPermission();
    if (p === "granted") cow.updateSettings({ notify: true });
    else
      toast.error(
        "Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser kalau berubah pikiran.",
      );
  };

  return (
    <PaperCard>
      <section id="teman" aria-label="Teman belajar" className="scroll-mt-24">
        <p className="section-kicker">Teman belajar</p>
        <h2 className="font-display text-2xl font-bold">Kenalan sama {cow.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sapi kecil yang menemanimu belajar: berubah suasana hati mengikuti timer dan
          mengingatkanmu untuk fokus.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MOODS.map((m) => (
            <div
              key={m.mood}
              className="rounded-md border border-border bg-background p-2 text-center"
            >
              <CowBuddy mood={m.mood} size={52} className="mx-auto" />
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 basis-48 gap-1.5 text-sm font-semibold">
            Nama sapimu
            <input
              className="field w-full"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Bu Mimi"
            />
          </label>
          <Button onClick={() => void save()} disabled={saving || name.trim() === cow.name}>
            Simpan nama
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            <span>
              Gelembung pengingat
              <span className="block text-xs font-normal text-muted-foreground">
                Pesan dari {cow.name} muncul di pojok layar.
              </span>
            </span>
            <Switch
              checked={cow.settings.bubble}
              onCheckedChange={(v) => cow.updateSettings({ bubble: v })}
              aria-label="Gelembung pengingat"
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            <span>
              Notifikasi browser
              <span className="block text-xs font-normal text-muted-foreground">
                Pengingat juga muncul sebagai notifikasi saat kamu di tab lain.
                {cow.permission === "denied" && " Izinnya sedang diblokir di browser."}
              </span>
            </span>
            <Switch
              checked={cow.settings.notify && cow.permission === "granted"}
              onCheckedChange={(v) => void toggleNotify(v)}
              aria-label="Notifikasi browser"
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            <span>
              Ingatkan kalau lama tidak belajar
              <span className="block text-xs font-normal text-muted-foreground">
                Hanya antara jam 8 pagi sampai 9 malam, dan tidak terlalu sering.
              </span>
            </span>
            <select
              className="field w-32"
              value={cow.settings.idleMinutes}
              onChange={(e) => cow.updateSettings({ idleMinutes: Number(e.target.value) })}
              aria-label="Ingatkan kalau lama tidak belajar"
            >
              {IDLE_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "Mati" : `${m} menit`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={cow.test}>
            <Bell /> Coba sapaan {cow.name}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pengingat berjalan selama aplikasi terbuka. Untuk pengingat saat aplikasi tertutup, blok
          belajar yang kamu jadwalkan ikut ke Google Calendar dan berbunyi di HP.
        </p>

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <Smartphone className="h-5 w-5" /> Pasang di layar utama
          </h3>
          {cow.install.standalone ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Aplikasi ini sudah terpasang. Ikon sapi ada di layar utamamu.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Terbuka seperti aplikasi biasa, tanpa bilah alamat browser. Setelah terpasang, tekan
                lama ikonnya untuk pintasan ke Timer, Belajar, dan Jadwal.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {cow.install.canPrompt && (
                  <Button onClick={() => void cow.install.prompt()}>
                    <Download /> Pasang aplikasi
                  </Button>
                )}
                {!cow.install.canPrompt && (
                  <p className="text-sm text-muted-foreground">
                    {cow.install.ios
                      ? "iPhone: buka di Safari, ketuk Bagikan, lalu Tambah ke Layar Utama."
                      : "Chrome atau Edge: buka menu titik tiga, lalu pilih Instal aplikasi (atau Tambahkan ke layar utama di HP)."}
                  </p>
                )}
              </div>
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Tampilan ringkas ala widget ada di{" "}
            <Link to="/widget" className="font-semibold text-primary underline">
              /widget
            </Link>
            . Pasang halaman itu ke layar utama untuk ikon tersendiri.
          </p>
        </div>
      </section>
    </PaperCard>
  );
}
