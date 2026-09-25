// Instancia central de Axios con interceptor JWT
import axios from 'axios'
import { useSessionStore } from '@/stores/session.store'

// Base URL tomada de la variable de entorno Vite
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de solicitud: añade el token JWT + contexto (member/device) ──
// `useSessionStore()` se llama DENTRO del handler (no a nivel de módulo) para
// que el Pinia activo ya exista cuando de verdad se dispare una petición
// (main.ts instala Pinia antes del router/mount). Si falta memberId/deviceId
// simplemente no se agregan los headers: el backend responde 403 para las
// rutas que los exigen (ContextGuard/SocioGuard), no hace falta anticiparlo aquí.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Un header ya presente en la petición manda sobre la sesión: la cola de
  // ventas offline reenvía cada venta con SU memberId/deviceId (el contrato
  // exige que coincidan con el cuerpo) aunque ahora atienda otra persona.
  const session = useSessionStore()
  if (session.memberId && !config.headers['x-member-id']) {
    config.headers['x-member-id'] = session.memberId
  }
  if (session.deviceId && !config.headers['x-device-id']) {
    config.headers['x-device-id'] = session.deviceId
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

    if (status === 401 && !isAuthEndpoint && !error.config?.skipAuthRedirect) {
      // Token expirado en ruta autenticada: limpiamos credenciales.
      // (Antes esto borraba una clave 'user' que ya no existe desde que se
      // adaptó el store al contrato real del backend — se corrige aquí.)
      localStorage.removeItem('access_token')
      localStorage.removeItem('token_expires_at')
      localStorage.removeItem('auth_username')
      // La persona seleccionada debe reconfirmarse al volver a iniciar
      // sesión; el dispositivo (físico, fijo) NO se limpia aquí.
      useSessionStore().clearMember()
      // Solo redirigimos si aún no estamos en /login (evita recargas innecesarias)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
