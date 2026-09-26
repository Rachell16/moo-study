-- Komponen nilai per mata kuliah (tugas, kuis, UTS, UAS, dst) dengan bobot dan nilai, untuk kalkulator nilai
-- dan prioritas belajar berdasarkan bobot yang paling menentukan.
CREATE TABLE public.grade_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  weight_percent numeric(5,2) NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100),
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grade_components_course_idx ON public.grade_components(course_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_components TO authenticated;
GRANT ALL ON public.grade_components TO service_role;
ALTER TABLE public.grade_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grade_components_owner_all" ON public.grade_components FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER grade_components_set_updated_at BEFORE UPDATE ON public.grade_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
