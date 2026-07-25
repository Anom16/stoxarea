import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, risk_profile } = body

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email dan password wajib diisi.' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      // Check existing user
      const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [email])
      if (checkRes.rows.length > 0) {
        return NextResponse.json({ detail: 'Email sudah terdaftar.' }, { status: 400 })
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10)

      // Insert new user
      const insertRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, risk_profile, is_admin)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, risk_profile, is_admin`,
        [email, password_hash, full_name || null, risk_profile || null, false]
      )

      return NextResponse.json(insertRes.rows[0], { status: 201 })
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ detail: `Server error: ${error.message}` }, { status: 500 })
  }
}
