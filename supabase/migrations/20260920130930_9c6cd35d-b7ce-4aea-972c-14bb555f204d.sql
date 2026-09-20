CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  code text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 30),
  color text NOT NULL DEFAULT 'sage',
  lecturer text,
  semester smallint NOT NULL DEFAULT 1 CHECK (semester BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_owner_all" ON public.courses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  activity_type text NOT NULL DEFAULT 'kuliah' CHECK (activity_type IN ('kuliah','belajar','praktikum','tugas')),
  google_event_id text,
  sync_status text NOT NULL DEFAULT 'lokal' CHECK (sync_status IN ('lokal','tersinkron','gagal')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_owner_all" ON public.schedules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX schedules_user_start_idx ON public.schedules(user_id, starts_at);
CREATE TRIGGER schedules_set_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  storage_path text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf','ppt','pptx')),
  material_type text NOT NULL DEFAULT 'kuliah' CHECK (material_type IN ('kuliah','praktikum')),
  semester smallint NOT NULL DEFAULT 1 CHECK (semester BETWEEN 1 AND 20),
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_owner_all" ON public.materials FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX materials_user_created_idx ON public.materials(user_id, created_at DESC);
CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  focus_minutes smallint NOT NULL CHECK (focus_minutes BETWEEN 1 AND 240),
  break_minutes smallint NOT NULL DEFAULT 5 CHECK (break_minutes BETWEEN 1 AND 60),
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "focus_sessions_owner_all" ON public.focus_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX focus_sessions_user_started_idx ON public.focus_sessions(user_id, started_at DESC);

CREATE POLICY "study_materials_read_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "study_materials_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "study_materials_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "study_materials_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);