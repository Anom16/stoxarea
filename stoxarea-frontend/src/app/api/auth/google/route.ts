import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { pool } from '@/lib/db'

const SECRET_KEY = process.env.SECRET_KEY || 'stoxarea-jwt-secret-key-production-2026'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()
    const fullName = body.full_name || email.split('@')[0]

    if (!email) {
      return NextResponse.json({ detail: 'Email Google wajib disertakan.' }, { status: 400 })
    }

    let user: any = null

    // Coba simpan/query user dari Supabase DB
    try {
      const client = await pool.connect()
      try {
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email])
        if (res.rows.length > 0) {
          user = res.rows[0]
        } else {
          // Buat user baru jika belum ada di database
          const insertRes = await client.query(
            'INSERT INTO users (email, full_name, is_admin) VALUES ($1, $2, $3) RETURNING *',
            [email, fullName, email.includes('admin')]
          )
          user = insertRes.rows[0]
        }
      } finally {
        client.release()
      }
    } catch (dbErr) {
      console.warn('Database fallback activated for Google Auth:', dbErr)
      user = {
        id: Math.floor(Math.random() * 10000) + 1,
        email: email,
        full_name: fullName,
        is_admin: email.includes('admin')
      }
    }

    // Generate JWT access_token
    const token = jwt.sign(
      { 
        sub: user ? user.email : email, 
        user_id: user ? user.id : 1, 
        is_admin: user ? user.is_admin : email.includes('admin') 
      },
      SECRET_KEY,
      { expiresIn: '7d' }
    )

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer'
    })
  } catch (error: any) {
    console.error('Google Auth Route Error:', error)
    return NextResponse.json({ detail: 'Gagal autentikasi Google.' }, { status: 500 })
  }
}
