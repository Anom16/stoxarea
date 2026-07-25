import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import jwt from 'jsonwebtoken'

const SECRET_KEY = process.env.SECRET_KEY || 'VLKbq54lKoyfWVHee2KJp1kunBvu9nOETyZA90pLpOA'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ detail: 'Token tidak valid' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload: any = jwt.verify(token, SECRET_KEY)

    const email = payload.sub
    const client = await pool.connect()
    try {
      const res = await client.query(
        'SELECT id, email, full_name, risk_profile, is_admin FROM users WHERE email = $1',
        [email]
      )
      if (res.rows.length === 0) {
        return NextResponse.json({ detail: 'User tidak ditemukan' }, { status: 404 })
      }

      return NextResponse.json(res.rows[0])
    } finally {
      client.release()
    }
  } catch (error: any) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
}
