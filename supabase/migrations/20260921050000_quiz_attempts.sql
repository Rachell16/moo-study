-- Riwayat latihan soal: tiap kali selesai satu sesi latihan, hasilnya disimpan.
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0),
  total integer NOT NULL CHECK (total > 0),
  mode text NOT NULL CHECK (mode IN ('acak10', 'acak20', 'semua', 'ulang_salah')),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  -- soal yang salah, disimpan lengkap dengan jawaban benar supaya tetap bisa dibaca walau soal dibuat ulang
  wrong jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempts_score_le_total CHECK (score <= total)
);
CREATE INDEX quiz_attempts_material_idx ON public.quiz_attempts(material_id, created_at DESC);
CREATE INDEX quiz_attempts_user_idx ON public.quiz_attempts(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_attempts_owner_all" ON public.quiz_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
