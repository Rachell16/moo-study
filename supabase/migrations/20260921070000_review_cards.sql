-- Kartu hafalan berjarak (sistem kotak Leitner): soal yang pernah salah muncul lagi beberapa hari kemudian.
CREATE TABLE public.review_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  qhash text NOT NULL CHECK (char_length(qhash) BETWEEN 1 AND 64),
  question jsonb NOT NULL,
  box integer NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count integer NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_cards_unique_question UNIQUE (user_id, material_id, qhash)
);
CREATE INDEX review_cards_due_idx ON public.review_cards(user_id, due_at);
CREATE INDEX review_cards_material_idx ON public.review_cards(material_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cards TO authenticated;
GRANT ALL ON public.review_cards TO service_role;
ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_cards_owner_all" ON public.review_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER review_cards_set_updated_at BEFORE UPDATE ON public.review_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
