-- Tugas, ujian, dan materi per kategori.

-- Singkatan mata kuliah (mis. "SMA, MAS") supaya "SMA LKP 4" langsung terhubung ke mata kuliahnya.
ALTER TABLE public.courses
  ADD COLUMN alias text NOT NULL DEFAULT '' CHECK (char_length(alias) <= 120);

-- Jadwal juga menampung deadline tugas dan ujian, jadi ikut tersinkron ke Google Calendar.
ALTER TABLE public.schedules DROP CONSTRAINT schedules_activity_type_check;
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_activity_type_check
  CHECK (activity_type IN ('kuliah','belajar','praktikum','tugas','ujian'));

ALTER TABLE public.schedules
  ADD COLUMN exam_kind text CHECK (exam_kind IN ('uts','uas')),
  ADD COLUMN urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN done boolean NOT NULL DEFAULT false;

CREATE INDEX schedules_user_type_start_idx ON public.schedules(user_id, activity_type, starts_at);

-- Materi: tandai untuk ujian mana dan sudah di-review atau belum.
ALTER TABLE public.materials
  ADD COLUMN exam_scope text NOT NULL DEFAULT 'uts' CHECK (exam_scope IN ('uts','uas')),
  ADD COLUMN reviewed_at timestamptz;

CREATE INDEX materials_user_course_idx ON public.materials(user_id, course_id);

-- Bucket privat untuk file materi (sebelumnya dibuat manual oleh Lovable Cloud).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials', 'study-materials', false, 52428800,
  ARRAY['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
ON CONFLICT (id) DO NOTHING;
