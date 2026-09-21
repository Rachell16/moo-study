-- Riwayat latihan yang bisa ditinjau lagi: simpan semua soal beserta jawabanmu (bukan hanya yang salah),
-- dan izinkan mode "kerjakan ulang set yang sama".
ALTER TABLE public.quiz_attempts
  ADD COLUMN review jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.quiz_attempts DROP CONSTRAINT quiz_attempts_mode_check;
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_mode_check
  CHECK (mode IN ('acak10', 'acak20', 'semua', 'ulang_salah', 'ulang_set'));
