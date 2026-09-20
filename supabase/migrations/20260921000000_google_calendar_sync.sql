-- Koneksi Google Calendar per pengguna.
-- Tabel ini HANYA dipakai server (service_role): refresh token tidak boleh terbaca dari browser,
-- jadi sengaja tidak ada policy maupun GRANT untuk role authenticated.
CREATE TABLE public.google_connections (
  user_id uuid PRIMARY KEY,
  google_email text,
  refresh_token text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_connections TO service_role;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER google_connections_set_updated_at BEFORE UPDATE ON public.google_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Satu event Google hanya boleh dipetakan ke satu jadwal per pengguna (cegah duplikat saat sinkron).
CREATE UNIQUE INDEX schedules_user_google_event_uidx ON public.schedules(user_id, google_event_id) WHERE google_event_id IS NOT NULL;
