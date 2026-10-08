ALTER TABLE tblAccounts
  ADD COLUMN emailVerified BOOLEAN NOT NULL DEFAULT TRUE AFTER email;

CREATE TABLE IF NOT EXISTS tblEmailVerifications (
  tokenHash CHAR(64) NOT NULL PRIMARY KEY,
  accountID INT NOT NULL UNIQUE,
  expiresAt DATETIME NOT NULL,
  INDEX (expiresAt),
  CONSTRAINT tblEmailVerifications_account_FK
    FOREIGN KEY (accountID) REFERENCES tblAccounts (accountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
