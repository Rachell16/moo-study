-- Ruang belajar: materi dipecah per poin (dibuat AI), soal latihan, dan catatan pribadi.
CREATE TABLE public.material_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  position integer NOT NULL,
  heading text NOT NULL CHECK (char_length(heading) BETWEEN 1 AND 200),
  summary text NOT NULL CHECK (char_length(summary) <= 3000),
  page integer CHECK (page IS NULL OR page > 0),
  understood boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_points_material_idx ON public.material_points(material_id, position);
CREATE INDEX material_points_user_idx ON public.material_points(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_points TO authenticated;
GRANT ALL ON public.material_points TO service_role;
ALTER TABLE public.material_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_points_owner_all" ON public.material_points FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER material_points_set_updated_at BEFORE UPDATE ON public.material_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.materials
  ADD COLUMN quiz jsonb,
  ADD COLUMN study_notes text NOT NULL DEFAULT '' CHECK (char_length(study_notes) <= 20000),
  ADD COLUMN outline_generated_at timestamptz,
  ADD COLUMN quiz_generated_at timestamptz;
