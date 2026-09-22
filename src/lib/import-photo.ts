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
