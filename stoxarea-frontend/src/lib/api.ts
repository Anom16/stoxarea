import axios from 'axios'

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'https://stoxarea-backend-production.up.railway.app'
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 4000,
  headers: { 'Content-Type': 'application/json' },
})

// Tambahkan Interceptor untuk menyisipkan Token di setiap request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('access_token') || sessionStorage.getItem('access_token'))
    : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Interceptor Tangani 401 (Token Expired / Tidak Valid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        sessionStorage.removeItem('access_token')
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
