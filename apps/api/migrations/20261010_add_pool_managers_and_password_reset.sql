ALTER TABLE tblAccounts
  MODIFY role ENUM('admin', 'poolbeheerder', 'user') NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS tblPoolManagers (
  accountID INT NOT NULL,
  poolID INT NOT NULL,
  PRIMARY KEY (accountID, poolID),
  INDEX (poolID),
  CONSTRAINT tblPoolManagers_account_FK
    FOREIGN KEY (accountID) REFERENCES tblAccounts (accountID) ON DELETE CASCADE,
  CONSTRAINT tblPoolManagers_pool_FK
    FOREIGN KEY (poolID) REFERENCES tblPools (poolID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tblPasswordResets (
  tokenHash CHAR(64) NOT NULL PRIMARY KEY,
  accountID INT NOT NULL UNIQUE,
  expiresAt DATETIME NOT NULL,
  INDEX (expiresAt),
  CONSTRAINT tblPasswordResets_account_FK
    FOREIGN KEY (accountID) REFERENCES tblAccounts (accountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
