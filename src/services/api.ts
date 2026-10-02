// Instancia central de Axios con interceptor JWT
import axios from 'axios'
import { API_BASE_URL, canSendDebt } from './queue-origin'
import type { QueueOrigin } from './queue-origin'
import { useSessionStore } from '@/stores/session.store'
import { currentSessionOwner, sameOwner } from './session-owner'
import type { SessionOwner } from './session-owner'
interface RequestContext {
  token: string | null
  owner: SessionOwner | null
  memberId: string | null
  deviceId: string | null
  deviceToken: string | null
}
function jwtOnly(url: string): boolean {
  return /^\/?(?:auth\/(?:login|register|me|change-password)|devices\/identify)(?:[?#]|$)/.test(url)
}

// Base URL tomada de la variable de entorno Vite
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de solicitud: añade el token JWT + contexto (member/device) ──
// `useSessionStore()` se llama DENTRO del handler (no a nivel de módulo) para
// que el Pinia activo ya exista cuando de verdad se dispare una petición
// (main.ts instala Pinia antes del router/mount). Si falta memberId/deviceId
// simplemente no se agregan los headers: el backend responde 403 para las
// rutas que los exigen (ContextGuard/SocioGuard), no hace falta anticiparlo aquí.
api.interceptors.request.use((config) => {
  const session = useSessionStore()
  session.reconcileOwnership()
  const origin = (config as typeof config & { debtOrigin?: QueueOrigin }).debtOrigin
  if (origin && !canSendDebt(origin)) throw new Error('Debt origin no longer matches the active session')
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Un header ya presente en la petición manda sobre la sesión: la cola de
  // ventas offline reenvía cada venta con SU memberId/deviceId (el contrato
  // exige que coincidan con el cuerpo) aunque ahora atienda otra persona.
  const snapshot: RequestContext = {
    token,
    owner: currentSessionOwner(),
    memberId: session.memberId,
    deviceId: session.deviceId,
    deviceToken: session.deviceToken,
  }
  ;(config as typeof config & { requestContext: RequestContext }).requestContext = snapshot
  if (jwtOnly(config.url ?? '')) {
    delete config.headers['x-member-id']
    delete config.headers['x-device-id']
    delete config.headers['x-device-token']
    return config
  }
  if (session.memberId && !config.headers['x-member-id']) {
    config.headers['x-member-id'] = session.memberId
  }
  if (session.deviceId && !config.headers['x-device-id']) {
    config.headers['x-device-id'] = session.deviceId
  }

  // Un dispositivo activado con el flujo de un solo uso debe mandar además su
  // token (x-device-token); uno heredado no tiene token y solo manda su id.
  // El token es de ESTE equipo: si la petición trae el x-device-id de otra
  // venta (cola offline), no se le pega el token de la sesión, que no le
  // corresponde y solo provocaría un 403. Se lee aquí, al enviar, así que una
  // venta encolada antes usa el token vigente cuando por fin se sincroniza.
  if (session.deviceToken && !config.headers['x-device-token']
      && config.headers['x-device-id'] === session.deviceId) {
    config.headers['x-device-token'] = session.deviceToken
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

    const snapshot = error.config?.requestContext as RequestContext | undefined
    const currentToken = localStorage.getItem('access_token')
    const sameRequest = !!snapshot && snapshot.token === currentToken
    if (status === 403 && error.response?.data?.message === 'Selection is not authorized for this context'
        && sameRequest && !jwtOnly(url)) {
      const session = useSessionStore()
      const headers = error.config?.headers
      if (sameOwner(snapshot.owner, currentSessionOwner()) && snapshot.memberId && snapshot.deviceId
          && snapshot.memberId === session.memberId && snapshot.deviceId === session.deviceId
          && snapshot.deviceToken === session.deviceToken
          && headers?.['x-member-id'] === session.memberId && headers?.['x-device-id'] === session.deviceId
          && (headers?.['x-device-token'] ?? null) === session.deviceToken) {
        session.clearMember()
        session.clearDevice()
        session.recoveryReason = 'rejected'
      }
    }
    if (status === 401 && sameRequest && !isAuthEndpoint && !error.config?.skipAuthRedirect) {
      // Token expirado en ruta autenticada: limpiamos credenciales.
      // (Antes esto borraba una clave 'user' que ya no existe desde que se
      // adaptó el store al contrato real del backend — se corrige aquí.)
      localStorage.removeItem('access_token')
      localStorage.removeItem('token_expires_at')
      localStorage.removeItem('auth_username')
      // La caché del vínculo cuenta-persona pertenece a la sesión que murió.
      localStorage.removeItem('account_binding')
      // La persona seleccionada debe reconfirmarse al volver a iniciar
      // sesión; el dispositivo (físico, fijo) NO se limpia aquí.
      useSessionStore().clearOnLogout()
      // Solo redirigimos si aún no estamos en /login (evita recargas innecesarias)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
