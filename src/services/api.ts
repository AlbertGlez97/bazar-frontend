// Instancia central de Axios con interceptor JWT
import axios from 'axios'

// Base URL tomada de la variable de entorno Vite
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de solicitud: añade el token JWT si existe ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de respuesta: redirige al login si el token expira ──
// OJO: el 401 del propio endpoint de /auth/login o /auth/register significa
// "credenciales inválidas", NO "token expirado". En ese caso lo maneja el
// caller (auth.store) y acá NO debemos redirigir (si no, la página se recarga
// y el mensaje de error se pierde). Tampoco recargamos si ya estamos en /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url    = error.config?.url ?? ''
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register')

    if (status === 401 && !isAuthEndpoint) {
      // Token expirado en ruta autenticada: limpiamos credenciales
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      // Solo redirigimos si aún no estamos en /login (evita recargas innecesarias)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
