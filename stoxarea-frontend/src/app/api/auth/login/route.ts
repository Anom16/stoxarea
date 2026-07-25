import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SECRET_KEY = process.env.SECRET_KEY || 'VLKbq54lKoyfWVHee2KJp1kunBvu9nOETyZA90pLpOA'

export async function POST(request: Request) {
  try {
    let email = ''
    let password = ''

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      email = (formData.get('username') as string) || (formData.get('email') as string) || ''
      password = (formData.get('password') as string) || ''
    } else {
      const body = await request.json()
      email = body.email || body.username || ''
      password = body.password || ''
    }

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email dan password wajib diisi.' }, { status: 400 })
    }

    // Query user from Supabase database
    const client = await pool.connect()
    let user: any = null
    try {
      const res = await client.query('SELECT * FROM users WHERE email = $1', [email])
      if (res.rows.length > 0) {
        user = res.rows[0]
      }
    } finally {
      client.release()
    }

    if (!user) {
      return NextResponse.json({ detail: 'Email atau password salah.' }, { status: 401 })
    }

    // Verify password hash
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ detail: 'Email atau password salah.' }, { status: 401 })
    }

    // Generate JWT access_token
    const token = jwt.sign(
      { sub: user.email, user_id: user.id, is_admin: user.is_admin },
      SECRET_KEY,
      { expiresIn: '1d' }
    )

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer'
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ detail: `Server error: ${error.message}` }, { status: 500 })
  }
}
