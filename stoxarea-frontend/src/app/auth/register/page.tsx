'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    // Tidak perlu halaman daftar terpisah — Google OAuth sudah otomatis buat akun baru
    router.replace('/auth/login')
  }, [router])

  return null
}
