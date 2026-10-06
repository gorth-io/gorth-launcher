// Public identity cache only. Credentials remain in the OS-encrypted vault.
export const userProfilesMigration = `
CREATE TABLE IF NOT EXISTS user_profiles (
  sso_user_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  username TEXT,
  email TEXT,
  image TEXT,
  email_verified INTEGER,
  created_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);
`;
