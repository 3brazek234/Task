require('dotenv').config();

const base = {
  client: 'pg',
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

// Helper: return undefined (not the string 'postgres') when the env var is empty
function envOrDefault(key, fallback) {
  const val = process.env[key];
  if (val === undefined || val === null) {
    return fallback;
  }
  // An empty string is a valid password (e.g. local trust auth)
  return val;
}

module.exports = {
  development: {
    ...base,
    connection: {
      host: envOrDefault('DB_HOST', 'localhost'),
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: envOrDefault('DB_NAME', 'appdb'),
      user: envOrDefault('DB_USER', 'postgres'),
      password: envOrDefault('DB_PASSWORD', 'postgres'),
    },
    pool: { min: 2, max: 10 },
  },

  test: {
    ...base,
    client: 'pg',
    connection: {
      host: envOrDefault('TEST_DB_HOST', 'localhost'),
      port: parseInt(process.env.TEST_DB_PORT, 10) || 5432,
      database: envOrDefault('TEST_DB_NAME', 'appdb_test'),
      user: envOrDefault('TEST_DB_USER', envOrDefault('DB_USER', 'postgres')),
      password: envOrDefault('TEST_DB_PASSWORD', envOrDefault('DB_PASSWORD', 'postgres')),
    },
    pool: { min: 1, max: 5 },
  },

  production: {
    ...base,
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 2, max: 20 },
  },
};
