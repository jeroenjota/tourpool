-- Organisaties met inleveradres, herbruikbaar voor meerdere pools.
CREATE TABLE IF NOT EXISTS tblOrganisaties (
  orgID INT NOT NULL AUTO_INCREMENT,
  naam VARCHAR(255) NOT NULL,
  straat VARCHAR(255) NULL,
  huisnummer VARCHAR(20) NULL,
  postcode VARCHAR(10) NULL,
  plaats VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  tel VARCHAR(30) NULL,
  PRIMARY KEY (orgID),
  UNIQUE KEY tblOrganisaties_naam_UQ (naam)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tblPools ADD COLUMN IF NOT EXISTS orgID INT NULL AFTER Org;

-- Bestaande organisatornamen omzetten naar organisaties.
INSERT IGNORE INTO tblOrganisaties (naam)
SELECT DISTINCT TRIM(Org) FROM tblPools WHERE Org IS NOT NULL AND TRIM(Org) <> '';

UPDATE tblPools p JOIN tblOrganisaties o ON o.naam = TRIM(p.Org)
SET p.orgID = o.orgID
WHERE p.orgID IS NULL;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tblPools' AND CONSTRAINT_NAME = 'tblPools_orgID_FK');
SET @fk_sql = IF(@fk_exists = 0,
  'ALTER TABLE tblPools ADD CONSTRAINT tblPools_orgID_FK FOREIGN KEY (orgID) REFERENCES tblOrganisaties (orgID) ON DELETE SET NULL',
  'SELECT 1');
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;
