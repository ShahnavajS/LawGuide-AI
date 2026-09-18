// Set before any service import so tests never open the workspace database.
process.env.DATABASE_URL = ':memory:';
