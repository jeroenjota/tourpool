-- Inschrijvingen zonder account: niet-betaalde gastploegen worden na 48 uur verwijderd.
ALTER TABLE tblDeelnemers
  ADD COLUMN IF NOT EXISTS aangemaakt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS gast TINYINT(1) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS tblDeelnemers_gast_IDX ON tblDeelnemers (gast, Betaald, aangemaakt);
