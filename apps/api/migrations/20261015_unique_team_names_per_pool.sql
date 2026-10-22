CREATE TEMPORARY TABLE tblDeelnemersDuplicateNames AS
SELECT d.deelnID
FROM tblDeelnemers d
JOIN (
  SELECT poolID, roepnaam, MIN(deelnID) AS keepID
  FROM tblDeelnemers
  WHERE roepnaam IS NOT NULL
  GROUP BY poolID, roepnaam
  HAVING COUNT(*) > 1
) duplicates ON duplicates.poolID = d.poolID AND duplicates.roepnaam = d.roepnaam
WHERE d.deelnID <> duplicates.keepID;

UPDATE tblDeelnemers d
JOIN tblDeelnemersDuplicateNames duplicates ON duplicates.deelnID = d.deelnID
SET d.roepnaam = CONCAT(LEFT(d.roepnaam, 180), ' [', UUID(), ']');

DROP TEMPORARY TABLE tblDeelnemersDuplicateNames;

ALTER TABLE tblDeelnemers
  DROP INDEX tblDeelnemers_pool_adr_roep_IDX,
  ADD UNIQUE KEY tblDeelnemers_pool_roep_IDX (poolID, roepnaam);
