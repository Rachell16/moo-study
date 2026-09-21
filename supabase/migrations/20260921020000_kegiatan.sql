-- Jenis agenda baru: 'kegiatan' (rapat organisasi, acara, dan kegiatan lain di luar kuliah).
ALTER TABLE public.schedules DROP CONSTRAINT schedules_activity_type_check;
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_activity_type_check
  CHECK (activity_type IN ('kuliah','belajar','praktikum','tugas','ujian','kegiatan'));
