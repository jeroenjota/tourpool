ALTER TABLE tblPuntenToekenning
  ADD COLUMN IF NOT EXISTS volgorde INT DEFAULT NULL;

UPDATE tblPuntenToekenning pa
INNER JOIN tblStandaardPunten sp ON sp.prestatieID = pa.prestatieID
SET pa.volgorde = sp.volgorde
WHERE pa.volgorde IS NULL AND sp.volgorde IS NOT NULL;
