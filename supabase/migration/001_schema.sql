-- SCHEMA ps-turni
-- Eseguire nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  data_chiusura_richieste date,
  pubblicato boolean NOT NULL DEFAULT false,
  calendario_pubblicato boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnisti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  turni_dovuti_per_slot integer NOT NULL DEFAULT 1,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  giorno date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('desiderata', 'indisponibilita')),
  nome_a text NOT NULL,
  nome_b text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assegnazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  giorno date NOT NULL,
  nome_a text NOT NULL,
  nome_b text,
  confermato boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turni_contatore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  nome text NOT NULL,
  turni_fatti numeric(4,1) NOT NULL DEFAULT 0,
  UNIQUE(slot_id, nome)
);

ALTER PUBLICATION supabase_realtime ADD TABLE preferenze;
ALTER PUBLICATION supabase_realtime ADD TABLE assegnazioni;
ALTER PUBLICATION supabase_realtime ADD TABLE slots;

ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE assegnazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnisti ENABLE ROW LEVEL SECURITY;
ALTER TABLE turni_contatore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_published_slots" ON slots FOR SELECT USING (pubblicato = true);
CREATE POLICY "read_preferenze" ON preferenze FOR SELECT USING (true);
CREATE POLICY "insert_preferenze" ON preferenze FOR INSERT WITH CHECK (true);
CREATE POLICY "delete_preferenze" ON preferenze FOR DELETE USING (true);
CREATE POLICY "read_assegnazioni" ON assegnazioni FOR SELECT USING (true);
CREATE POLICY "read_turnisti" ON turnisti FOR SELECT USING (attivo = true);
CREATE POLICY "read_contatori" ON turni_contatore FOR SELECT USING (true);