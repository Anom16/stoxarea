import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.akytzkebyghoxmvqgnst:miiwaashi16@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres'

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
})
