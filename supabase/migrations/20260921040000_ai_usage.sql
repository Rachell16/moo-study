-- Catatan pemakaian AI, untuk membatasi jatah gratis Gemini per pengguna per hari.
-- Hanya server (service_role) yang boleh membaca dan menulis: sengaja tanpa GRANT/policy untuk authenticated,
-- supaya pengguna tidak bisa menghapus catatannya sendiri untuk menyiasati batas.
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_time_idx ON public.ai_usage(user_id, created_at);
CREATE INDEX ai_usage_time_idx ON public.ai_usage(created_at);
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
