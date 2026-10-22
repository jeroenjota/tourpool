ALTER TABLE tblPools
  ADD UNIQUE KEY tblPools_tourID_orgID_UQ (tourID, orgID);
