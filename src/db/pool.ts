import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.warn('DATABASE_URL is not set. Neon database checks will fail until configured.')
}

export const dbPool = new Pool({
  connectionString: databaseUrl,
})
