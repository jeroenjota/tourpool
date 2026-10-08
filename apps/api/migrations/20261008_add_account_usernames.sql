ALTER TABLE tblAccounts ADD COLUMN username VARCHAR(64) NULL AFTER accountID;
UPDATE tblAccounts SET username = email;
ALTER TABLE tblAccounts
  MODIFY username VARCHAR(64) NOT NULL,
  ADD UNIQUE KEY tblAccounts_username_UQ (username);
