// Kalkulator nilai per mata kuliah: dari komponen (tugas/kuis/UTS/UAS) dengan bobot dan nilai,
// hitung nilai berjalan, perkiraan akhir, target di komponen yang tersisa, dan mana yang paling
// menentukan untuk diprioritaskan belajarnya. Murni, tanpa akses data, supaya bisa dites di Node.

export type GradeComponent = {
  id: string;
  name: string;
  weightPercent: number;
  score: number | null;
};

export type CourseGradeSummary = {
  totalWeight: number; // total bobot semua komponen (idealnya 100, boleh belum lengkap)
  gradedWeight: number; // bobot komponen yang sudah ada nilainya
  remainingWeight: number; // bobot komponen yang belum ada nilai
  earnedPoints: number; // sum(score * weight / 100) dari yang sudah dinilai
  runningPercent: number | null; // earnedPoints / gradedWeight * 100 — rata-rata performa sejauh ini (null kalau belum ada yang dinilai)
  projectedFinal: number | null; // proyeksi nilai akhir kalau sisanya dapat skor sama seperti rata-rata sekarang (null kalau belum ada yang dinilai)
  nextComponent: GradeComponent | null; // komponen belum dinilai dengan bobot terbesar — ini yang paling menentukan
};

export function summarizeCourse(components: GradeComponent[]): CourseGradeSummary {
  const totalWeight = round2(components.reduce((s, c) => s + c.weightPercent, 0));
  const graded = components.filter((c) => c.score !== null);
  const ungraded = components.filter((c) => c.score === null);
  const gradedWeight = round2(graded.reduce((s, c) => s + c.weightPercent, 0));
  const remainingWeight = round2(totalWeight - gradedWeight);
  const earnedPoints = round2(graded.reduce((s, c) => s + (c.score! * c.weightPercent) / 100, 0));
  const runningPercent = gradedWeight > 0 ? round2((earnedPoints / gradedWeight) * 100) : null;
  const projectedFinal =
    gradedWeight > 0 ? round2(earnedPoints + (runningPercent! * remainingWeight) / 100) : null;
  const nextComponent = ungraded.length
    ? ungraded.reduce((a, b) => (b.weightPercent > a.weightPercent ? b : a))
    : null;
  return {
    totalWeight,
    gradedWeight,
    remainingWeight,
    earnedPoints,
    runningPercent,
    projectedFinal,
    nextComponent,
  };
}

// Nilai rata-rata yang dibutuhkan di seluruh komponen yang tersisa (digabung) supaya nilai akhir mencapai target.
// null kalau semua komponen sudah dinilai (tidak ada yang bisa dikejar), dan angka bisa >100 atau <0 kalau targetnya
// sudah mustahil/sudah pasti tercapai — pesan itu diserahkan ke tampilan, di sini hanya angka mentahnya.
export function neededOnRemaining(
  components: GradeComponent[],
  targetFinal: number,
): number | null {
  const s = summarizeCourse(components);
  if (s.remainingWeight <= 0) return null;
  return round2(((targetFinal - s.earnedPoints) / s.remainingWeight) * 100);
}

// Urutkan beberapa mata kuliah berdasarkan mana yang paling "berdampak" untuk dipelajari duluan:
// bobot komponen berikutnya yang belum dinilai (makin besar makin genting), lalu nilai berjalan yang lebih lemah duluan.
export function rankByImpact<T extends { courseId: string; components: GradeComponent[] }>(
  courses: T[],
): (T & { summary: CourseGradeSummary })[] {
  return courses
    .map((c) => ({ ...c, summary: summarizeCourse(c.components) }))
    .filter((c) => c.summary.nextComponent !== null)
    .sort((a, b) => {
      const w = b.summary.nextComponent!.weightPercent - a.summary.nextComponent!.weightPercent;
      if (w !== 0) return w;
      return (a.summary.runningPercent ?? 100) - (b.summary.runningPercent ?? 100);
    });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
