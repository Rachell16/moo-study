// Perintah AI untuk membaca jadwal kuliah dari foto (KRS, tabel jadwal, atau tulisan tangan), dan pembersih jawabannya.
// Hasilnya sengaja teks bebas dengan format yang sama seperti yang dipahami parseTimetable (lib/parse-timetable.ts),
// supaya bisa dipakai ulang persis alur "tempel jadwal dari chat" yang sudah ada: tidak ada parser baru untuk dites.

export const SCHEDULE_SYSTEM_PROMPT =
  "Kamu asisten yang membaca jadwal kuliah dari foto (tabel KRS, jadwal cetak, atau papan pengumuman) untuk mahasiswa Indonesia. " +
  "Tulis ulang isinya persis dengan format yang diminta; jangan menambah kelas yang tidak ada di foto, dan jangan mengarang jam atau ruangan yang tidak terbaca.";

export const SCHEDULE_PHOTO_PROMPT = `Baca foto jadwal kuliah ini. Kelompokkan tiap kelas per hari, lalu tulis ulang PERSIS dengan format berikut (bukan JSON, bukan tabel, teks biasa):

*HARI SENIN*

*10:00 - 11:40*
Mata Kuliah: KEB1316 Sistem Multi-Agen (K/1)
Ruangan: IPB W8 502
PJ: Nama Dosen

*13:00 - 14:40*
Mata Kuliah: KEB1412 Visi Komputer (K/1)
Ruangan: Lab Dasar 3
PJ: Nama Dosen

*HARI SELASA*
...dan seterusnya untuk tiap hari yang ada di foto.

Aturan:
- Urutkan hari Senin sampai Minggu, dan tiap hari urutkan dari jam paling pagi.
- "Mata Kuliah" diisi kode mata kuliah (kalau ada, contoh KEB1316) diikuti nama mata kuliah, lalu (K/<nomor>) untuk kelas kuliah atau (P/<nomor>) untuk praktikum. Kalau tidak ada nomor kelas di foto, pakai (K/1).
- Kalau kode mata kuliah tidak terbaca atau tidak ada di foto, tulis nama mata kuliahnya saja tanpa kode.
- Kalau ruangan atau nama dosen tidak terbaca, tulis "Ruangan: -" atau "PJ: -", jangan mengarang.
- Kalau ada jam yang tulisannya tidak jelas, lewati baris itu saja daripada menebak.
- Jangan tulis apa pun selain format di atas: tidak ada salam pembuka atau catatan penutup.`;

// Jawaban kadang dibungkus ```; ambil isi polosnya saja. Selain itu, teks dari AI dipakai apa adanya,
// karena parseTimetable sendiri sudah toleran terhadap simbol markdown (*, tanda kutip aneh, dsb).
export function cleanScheduleText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ---- rubrik nilai (bobot komponen per mata kuliah) dari foto catatan/slide dosen ----

export const GRADE_SYSTEM_PROMPT =
  "Kamu asisten yang membaca rubrik penilaian mata kuliah dari foto (catatan tulisan tangan, slide dosen, atau kontrak perkuliahan) untuk mahasiswa Indonesia. " +
  "Tulis ulang isinya persis dengan format yang diminta; jangan menambah komponen yang tidak ada di foto, dan jangan mengarang bobot yang tidak terbaca.";

export const GRADE_PHOTO_PROMPT = `Baca foto rubrik nilai ini. Foto ini bisa berisi rubrik untuk satu atau beberapa mata kuliah sekaligus (mis. dua kolom berdampingan). Untuk SETIAP mata kuliah yang ada di foto, tulis ulang PERSIS dengan format berikut (bukan JSON, bukan tabel, teks biasa):

STR
Tugas+aktivitas 10%
UTS 15%
UAS 20%
UTSP 25%
UASP 30%

SMA
Aktifitas 5%
Projek 50%
Tugas 5%
...dan seterusnya untuk tiap mata kuliah yang ada di foto.

Aturan:
- Baris pertama tiap mata kuliah: nama atau singkatan mata kuliah PERSIS seperti tertulis di foto (mis. "STR", "SMA", "ML", "VISKOM"), tanpa tanda "%".
- Baris berikutnya: satu komponen nilai per baris, format "Nama komponen BOBOT%", persis seperti tertulis (boleh disingkat/digabung, mis. "Tugas+aktivitas", "Kuis/Tugas").
- Pisahkan tiap mata kuliah dengan satu baris kosong.
- Kalau ada tulisan yang tidak terbaca jelas atau dicoret, lewati baris itu saja daripada menebak.
- Jangan tulis apa pun selain format di atas: tidak ada salam pembuka atau catatan penutup.`;
