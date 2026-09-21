# Moo Study

Ruang belajar pribadi: jadwal kuliah, tugas dengan deadline, hitung mundur UTS/UAS, dan materi (PDF/PPT) per mata kuliah. Jadwal tersambung dua arah ke Google Calendar.

TanStack Start (React) + Supabase (Postgres, Auth, Storage). Tidak lagi bergantung pada Lovable.

## Fitur

- **Jadwal**: kalender mingguan. Ketik satu kalimat di kotak atas, mis. "rapat hima hari rabu jam 12.00", dan hari, jam, serta lokasinya (kata "di …") dibaca otomatis lalu langsung dijadwalkan. Tombol **Impor jadwal kuliah** membaca jadwal dari teks chat (hari, jam, mata kuliah, ruangan, PJ), lalu mengulangnya tiap minggu.
- **Tugas**: tempel daftar tugas, nama, tanggal, dan jam terbaca otomatis. Tanda ‼️ berarti penting. Singkatan seperti SMA, ML, CV dihubungkan ke mata kuliahnya. Tiap tugas jadi blok 30 menit di Jadwal yang berakhir di deadline.
- **Ujian**: hitung mundur UTS/UAS per mata kuliah, plus progres materi yang sudah dan belum di-review.
- **Timer**: preset Podomoro (25/5, 50/10, 90/20) atau angka sendiri, istirahat panjang tiap beberapa sesi, mulai otomatis, dan bunyi saat selesai. Sesi fokus yang selesai tercatat, jadi streak dan ringkasan "sesi hari ini" nyata. Streak kembali ke 0 kalau ada hari yang terlewat.
- **Ruang belajar** (`/belajar`): rencana "ayo belajar ini hari ini" yang disusun dari jadwal kuliah, deadline tugas, jadwal ujian, dan materi yang belum di-review, lalu ditempatkan di waktu kosong (tombol Jadwalkan memasukkannya ke kalender). Per materi ada ruang belajar (hasil tiap latihan soal tersimpan di **riwayat**: skor, tren, dan seluruh soal beserta jawabanmu yang bisa **ditinjau ulang** (filter semua/salah/benar) atau dikerjakan ulang, juga terlihat di halaman Materi): PDF di kiri, di kanan poin-poin materi (dibuat AI) dengan tanda "sudah paham", latihan soal pilihan ganda, dan catatan.
- **Materi**: dikelompokkan per mata kuliah, lalu per Kuliah dan Praktikum. Tiap file ditandai untuk UTS atau UAS dan punya status review.
- **Google Calendar**: agenda, deadline tugas, dan ujian ikut tersinkron. Ada pengingat otomatis (tugas H-1 dan 3 jam, ujian H-3 dan H-1).

## Menjalankan di laptop

Butuh Node.js 22.18 atau lebih baru.

1. Buat project di https://supabase.com (paket Free cukup).
2. Buat tabelnya: buka **SQL Editor**, jalankan isi semua file di `supabase/migrations/` **berurutan** (nama file yang lebih kecil dulu). Atau pakai Supabase CLI: `supabase link --project-ref XXXX` lalu `supabase db push`.
3. Salin `.env.example` jadi `.env`, isi dari **Project Settings > API** (URL, publishable key, dan service_role key).
4. Di **Authentication > Providers**, pastikan Email aktif. Di **Authentication > URL Configuration**, isi Site URL `http://localhost:3000` dan tambahkan alamat yang sama di Redirect URLs.
5. Jalankan:

```bash
npm install
npm run dev
```

Buka http://localhost:3000, klik **Masuk**, buat akun, lalu buka **Jadwal > Impor jadwal kuliah**.

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai server (untuk menyimpan token Google). Jangan diberi awalan `VITE_` dan jangan di-commit.

## Login dengan Google (opsional)

Tombol "Lanjutkan dengan Google" di halaman masuk memakai Supabase Auth langsung. Aktifkan di **Authentication > Providers > Google**, isi Client ID dan Secret dari Google Cloud, lalu daftarkan `https://XXXX.supabase.co/auth/v1/callback` sebagai Authorized redirect URI di Google Cloud. Ini terpisah dari sinkron kalender di bawah.

## Sinkron Google Calendar

1. Di https://console.cloud.google.com buat project, aktifkan **Google Calendar API**, isi **OAuth consent screen** (External, tambahkan emailmu di Test users), lalu buat **OAuth client ID** tipe Web application.
2. Di _Authorized redirect URIs_ daftarkan tiap alamat yang dipakai, satu baris per domain:
   - `http://localhost:3000/api/google/callback`
   - `https://DOMAIN-DEPLOY-KAMU/api/google/callback`
3. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.env` (dan di environment hosting). Opsional: `TIMEZONE` (bawaan `Asia/Jakarta`).
4. Buka **Jadwal**, klik **Hubungkan**, lalu izinkan akses kalender.

Cara kerjanya:

- Agenda yang dibuat atau diubah ditandai `lokal`, lalu dikirim ke Google (jadi `tersinkron`). Yang gagal ditandai `gagal` dan dicoba lagi.
- Pengiriman bertahap, 30 agenda per panggilan, jadi impor jadwal satu semester (ratusan agenda) tidak membuat server kehabisan waktu. Progresnya tampil di kartu Google Calendar.
- Perubahan dari Google ditarik untuk rentang 30 hari ke belakang sampai 120 hari ke depan, otomatis saat halaman Jadwal dibuka dan tiap 5 menit.
- Dihapus di satu sisi, ikut terhapus di sisi lain. Kalau diubah di dua tempat sebelum sempat sinkron, versi dari aplikasi ini yang menang.
- Deadline tugas tampil di Google sebagai "Deadline: nama tugas", berwarna merah tomat kalau penting.
- Kegiatan seharian di Google dilewati (jadwal butuh jam mulai dan selesai).
- Selama app Google berstatus _Testing_, izin habis tiap 7 hari. Klik Hubungkan lagi kalau muncul pesan izin kedaluwarsa.

Refresh token disimpan di tabel `google_connections` yang tidak bisa dibaca dari browser (RLS aktif tanpa policy), hanya server yang mengaksesnya. Login Google memakai `state` bertanda tangan HMAC.

## Deploy

Bawaannya build untuk **Vercel**: push repo ke GitHub, import di Vercel, isi environment variables dari `.env.example`, deploy. Untuk host lain set `NITRO_PRESET` saat build, misalnya `node-server` (VPS, Docker, Railway, Render), `netlify`, atau `cloudflare-module`.

Setelah dapat domainnya: tambahkan ke Redirect URLs di Supabase, dan ke Authorized redirect URIs di Google Cloud (langkah sinkron di atas).

## Tes

```bash
npm test          # parser tugas, parser jadwal kuliah, singkatan mata kuliah
npm run typecheck
```

## Struktur

```
src/routes/            halaman (jadwal, tugas, ujian, materi, timer, auth) + api/google/callback
src/lib/               parser (parse-tasks, parse-timetable), sinkron Google (google.server.ts), server functions
src/hooks/             data (react-query), sesi login, sinkron Google
src/components/        dialog dan komponen UI
supabase/migrations/   skema database (jalankan berurutan)
tests/                 tes parser
```

## Catatan pindah dari Lovable

- Konfigurasi Vite, login Google, dan penyimpanan sesi sudah dibuat mandiri. File khusus Lovable dihapus.
- Data di database Lovable Cloud tidak ikut pindah. Kalau ada yang perlu dibawa, ekspor dari tabelnya dan impor ke project Supabase barumu.
- `src/integrations/supabase/types.ts` ditulis manual mengikuti migrasi. Kalau skema berubah, buat ulang dengan `supabase gen types typescript --project-id XXXX`.

## Fitur AI (ruang belajar)

Rencana belajar harian berjalan tanpa AI. Memecah materi jadi poin dan membuat soal latihan memakai **Google Gemini** lewat kunci gratis.

1. Buka https://aistudio.google.com, login, klik **Get API key** lalu **Create API key** (tanpa kartu kredit).
2. Simpan sebagai `GEMINI_API_KEY` di `.env` (lokal) dan di Vercel (Settings, Environment Variables), lalu Redeploy.
3. Opsional: `GEMINI_MODEL` untuk mengganti model. Bawaannya `gemini-3.7-flash`. Pakai model Flash yang termasuk paket gratis.

Catatan:

- Hanya PDF yang bisa dibaca AI (maksimal sekitar 14 MB). Slide PPT diubah jadi PDF dulu.
- Di paket gratis, Google boleh memakai isi yang dikirim untuk meningkatkan produknya, jadi jangan dipakai untuk materi rahasia.
- Kalau muncul pesan batas gratis tercapai, tunggu beberapa menit lalu coba lagi.
- Kalau model utama sibuk (error 5xx) atau kena batas, aplikasi mengulang beberapa kali lalu mencoba model cadangan (`GEMINI_FALLBACK_MODELS`, bawaan `gemini-flash-lite-latest`). Pesan errornya menyertakan pesan asli dari Google supaya penyebabnya bisa dilacak.
- Di ruang belajar ada pilihan **Cepat / Seimbang / Teliti** (tingkat berpikir AI: low, medium, high). Makin teliti makin bagus untuk materi rumit, tapi makin lama dan makin berat bagi jatah gratis.
- Satu klik "Siapkan materi dengan AI" memakai **satu** permintaan Gemini untuk poin sekaligus 15 sampai 30 soal. Jatah gratis project (cek di AI Studio, Rate Limit) hanya belasan permintaan per hari, jadi aplikasi membatasi tiap akun (bawaan 8 per hari) dan totalnya (bawaan 18). Ubah lewat `AI_DAILY_LIMIT_PER_USER`, `AI_DAILY_LIMIT_GLOBAL`, dan `AI_RESET_TZ`.
- Migrasi `20260921040000_ai_usage.sql` membuat tabel pencatat pemakaian (hanya bisa diakses server).
- Migrasi `20260921030000_ruang_belajar.sql` membuat tabel `material_points` serta kolom soal dan catatan di `materials`.

## Teman belajar, timer melayang, widget, dan aplikasi terpasang

- **Sapi teman belajar** (pojok kanan bawah): punya nama (diatur di Timer, kartu "Teman belajar", tersimpan di akunmu) dan enam suasana hati (santai, fokus, istirahat, hore, mengingatkan, tidur) yang mengikuti timer. Ia mengingatkan lewat gelembung (dan notifikasi browser kalau diizinkan) saat blok belajar dimulai, tugas tinggal kurang dari 3 jam, atau lama tidak belajar (30, 60, atau 90 menit; hanya jam 8 pagi sampai 9 malam). Pengingat hanya berjalan selama aplikasi terbuka; untuk pengingat saat aplikasi tertutup, blok belajar yang dijadwalkan ikut ke Google Calendar.
- **Timer melayang**: timer hidup di provider global (`use-timer.tsx`), jadi tetap jalan dan terlihat sebagai pil kecil saat membuka materi atau halaman lain. Keadaannya disimpan, jadi pulih setelah halaman dimuat ulang.
- **Widget** (`/widget`): tampilan ringkas untuk jadwal berikutnya, timer, dan streak. Pasang halaman itu ke layar utama untuk ikon tersendiri. Ini bukan widget bawaan sistem (iOS atau Android), karena aplikasi web tidak bisa membuatnya.
- **PWA**: `manifest.webmanifest`, `sw.js`, dan `offline.html` di `public/`. Service worker sengaja tidak menyimpan halaman atau data (hanya halaman offline), supaya tidak pernah menampilkan versi lama setelah deploy.
