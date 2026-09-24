// Tests unitarios del auth store — aislamiento E2EE + estado cryptoWarning
// El mock de crypto.store DEBE ir antes del import de auth.store porque
// useAuthStore llama a useCryptoStore() durante el setup del store (no lazy).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Stub completo del cryptoStore — declarado antes de cualquier import de auth.store
// para que vi.mock lo intercepte cuando el módulo se evalúe por primera vez.
vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    canRestore:     vi.fn(() => false),
    initSession:    vi.fn(() => Promise.resolve()),
    restoreSession: vi.fn(() => Promise.resolve()),
    clearSession:   vi.fn(),
    wipeSession:    vi.fn(),
    isReady:        false,
  })),
}))

vi.mock('@/services/auth.service')

// toast.store no lo usa authStore directamente, pero evitamos errores en imports transitivos
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    info:    vi.fn(),
    success: vi.fn(),
    error:   vi.fn(),
  }),
}))

import { useAuthStore } from '@/stores/auth.store'
import AuthService from '@/services/auth.service'
import { useCryptoStore } from '@/stores/crypto.store'
import type { User } from '@/types/auth.types'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockUser: User = {
  id:          'u-1',
  email:       'usuario@test.com',
  name:        'Test User',
  currency:    'MXN',
  ruleNeeds:   50,
  ruleWants:   30,
  ruleSavings: 20,
  isActive:    true,
  createdAt:   '2026-04-01T00:00:00Z',
}

const mockAuthResponse = {
  accessToken: 'tok-abc-123',
  usuario:     { id: mockUser.id, name: mockUser.name, email: mockUser.email, currency: mockUser.currency },
}

// ── Phase 1: estado cryptoWarning ──────────────────────────────────────────────

describe('useAuthStore — cryptoWarning: estado y lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Limpiar localStorage para evitar contaminación entre tests
    localStorage.clear()
  })

  // Subtask 1.1 — RED: estado inicial
  it('cryptoWarning inicia en null (REQ-AS-STATE-01)', () => {
    const store = useAuthStore()
    // El store debe exponer cryptoWarning como parte de su estado público
    expect(store.cryptoWarning).toBeNull()
  })

  // Subtask 1.1 — RED: logout resetea cryptoWarning
  it('logout resetea cryptoWarning a null (Scenario 11 / REQ-AS-STATE-02)', () => {
    const store = useAuthStore()

    // Simulamos estado degradado asignando directamente a la propiedad pública del store.
    // En Pinia setup stores, las refs retornadas se desenvuelven automáticamente en el proxy,
    // así que `store.cryptoWarning = 'x'` equivale a setear el ref interno.
    // En Phase 2 esto lo hará login(); acá lo forzamos para aislar el test.
    ;(store as unknown as Record<string, unknown>).cryptoWarning = 'Cifrado local no disponible'
    expect(store.cryptoWarning).toBe('Cifrado local no disponible')

    store.logout()

    expect(store.cryptoWarning).toBeNull()
  })
})

// ── Phase 1 Subtask 1.3 — RED: _extractCryptoWarning branches ─────────────────
// Estos tests son INTENCIONALMENTE ROJOS en esta fase: login() aún no tiene
// el try/catch secundario que poblaría cryptoWarning. Se ponen rojos aquí
// y se pondrán verdes en Phase 2 cuando se refactorice login().

describe('useAuthStore — _extractCryptoWarning: ramas de clasificación de error', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('DOMException → mensaje específico de restauración de cifrado (Scenario 3)', async () => {
    // El backend responde OK pero la restauración del cifrado falla con DOMException
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    // cryptoStore con canRestore=false → va por initSession que lanza DOMException
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    vi.fn(() => Promise.reject(new DOMException('operation failed', 'OperationError'))),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    // login() debe resolver sin relanzar (REQ-AS-LOGIN-07)
    await store.login({ email: 'usuario@test.com', password: 'pass123' })

    // El mensaje para DOMException es específico (no el e.message crudo)
    expect(store.cryptoWarning).toBe(
      'No se pudo restaurar tu cifrado local. Volvé a intentar o continuá sin cifrado en este dispositivo.'
    )
    // El error de autenticación NO se setea (REQ-AS-LOGIN-06)
    expect(store.error).toBeNull()
  })

  it('Error genérico → e.message crudo en cryptoWarning (Scenario 2)', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    vi.fn(() => Promise.reject(new Error('WebCrypto no disponible'))),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await store.login({ email: 'usuario@test.com', password: 'pass123' })

    // Para Error con .message, se usa el mensaje crudo
    expect(store.cryptoWarning).toBe('WebCrypto no disponible')
    expect(store.error).toBeNull()
  })

  it('error sin .message → fallback genérico legible (lanzar string u objeto plano)', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    // Lanzamos un objeto que no tiene .message
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      initSession:    vi.fn(() => Promise.reject({ code: 42 })),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await store.login({ email: 'usuario@test.com', password: 'pass123' })

    expect(store.cryptoWarning).toBe('El cifrado local no está disponible en este dispositivo.')
    expect(store.error).toBeNull()
  })
})

// ── Phase 3: register() — contrato Fase C ──────────────────────────────────────
// Nuevo flow: el cliente genera el material crypto ANTES de llamar register()
// (en el wizard, paso 2). El register solo hace POST con el material ya hecho
// y, si OK, persiste el cache local vía persistPasswordCache. Si POST falla,
// clearSession + re-throw para que el wizard pueda ofrecer reintentar.

// Fixture: payload completo con material crypto ya generado (simula lo que envía
// el wizard tras pasar el paso 2 y 3).
const registerPayloadWithCrypto = {
  name:     'Test User',
  email:    'nuevo@test.com',
  password: 'pass123',
  saltPassword:       'salt-p',
  wrappedDekPassword: { iv: 'iv-p', ct: 'ct-p' },
  saltRecovery:       'salt-r',
  wrappedDekRecovery: { iv: 'iv-r', ct: 'ct-r' },
}

describe('useAuthStore — register(): flow Fase C', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('happy path: POST OK → persistPasswordCache con userId real y valores del payload', async () => {
    vi.mocked(AuthService.register).mockResolvedValue(mockAuthResponse)
    const mockPersist = vi.fn()
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:          vi.fn(() => false),
      initSession:         vi.fn(),
      persistPasswordCache: mockPersist,
      restoreSession:      vi.fn(),
      clearSession:        vi.fn(),
      wipeSession:         vi.fn(),
      isReady:             false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await store.register(registerPayloadWithCrypto)

    expect(store.token).toBe('tok-abc-123')
    expect(store.error).toBeNull()
    expect(store.cryptoWarning).toBeNull()
    // Persiste el cache con el userId del backend y los valores del payload
    expect(mockPersist).toHaveBeenCalledWith(
      mockUser.id,             // id que viene en mockAuthResponse.usuario
      'salt-p',
      { iv: 'iv-p', ct: 'ct-p' },
    )
  })

  it('backend 409: relanza error, NO persiste cache, llama clearSession (DEK huérfana)', async () => {
    const backendError = { response: { data: { message: 'Email ya registrado' } } }
    vi.mocked(AuthService.register).mockRejectedValue(backendError)

    const mockPersist      = vi.fn()
    const mockClearSession = vi.fn()
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:          vi.fn(() => false),
      initSession:         vi.fn(),
      persistPasswordCache: mockPersist,
      restoreSession:      vi.fn(),
      clearSession:        mockClearSession,
      wipeSession:         vi.fn(),
      isReady:             false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()

    await expect(store.register(registerPayloadWithCrypto)).rejects.toBe(backendError)

    expect(store.error).toBe('Email ya registrado')
    expect(store.token).toBeNull()
    expect(mockPersist).not.toHaveBeenCalled()
    expect(mockClearSession).toHaveBeenCalled()   // limpia la DEK en RAM si el POST falla
    expect(store.loading).toBe(false)
  })

  it('resetea cryptoWarning stale al iniciar register (no contamina del login previo)', async () => {
    vi.mocked(AuthService.register).mockResolvedValue(mockAuthResponse)
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:          vi.fn(() => false),
      initSession:         vi.fn(),
      persistPasswordCache: vi.fn(),
      restoreSession:      vi.fn(),
      clearSession:        vi.fn(),
      wipeSession:         vi.fn(),
      isReady:             false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    ;(store as unknown as Record<string, unknown>).cryptoWarning = 'stale warning anterior'

    await store.register(registerPayloadWithCrypto)

    expect(store.cryptoWarning).toBeNull()
  })
})

// ── Phase 4: recovery flow (Fase D) ────────────────────────────────────────────

describe('useAuthStore — recovery flow Fase D', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('recoverInit devuelve el material del backend y no toca la sesión', async () => {
    const mockMaterial = {
      saltRecovery:       'salt-r-from-backend',
      wrappedDekRecovery: { iv: 'iv-r', ct: 'ct-r' },
    }
    vi.mocked(AuthService.initRecovery).mockResolvedValue(mockMaterial)

    const store  = useAuthStore()
    const result = await store.recoverInit('user@test.com')

    expect(result).toEqual(mockMaterial)
    expect(store.token).toBeNull()   // No crea sesión todavía
    expect(store.user).toBeNull()
  })

  it('recoverComplete: genera material nuevo, llama backend, guarda sesión y cachea', async () => {
    vi.mocked(AuthService.completeRecovery).mockResolvedValue(mockAuthResponse)

    const mockRotate = vi.fn().mockResolvedValue({
      saltPassword:       'new-salt-p',
      wrappedDekPassword: { iv: 'new-iv', ct: 'new-ct' },
    })
    const mockPersist = vi.fn()
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:                  vi.fn(() => false),
      initSession:                 vi.fn(),
      persistPasswordCache:        mockPersist,
      restoreSession:              vi.fn(),
      recoverWithPhrase:           vi.fn(),
      rotatePasswordAfterRecovery: mockRotate,
      clearSession:                vi.fn(),
      wipeSession:                 vi.fn(),
      isReady:                     false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await store.recoverComplete('user@test.com', 'NuevaContraseña123')

    // Llamó al crypto store para generar nuevo material (sin userId todavía)
    expect(mockRotate).toHaveBeenCalledWith('NuevaContraseña123')

    // Envió al backend el email + material + nueva contraseña
    expect(AuthService.completeRecovery).toHaveBeenCalledWith({
      email:              'user@test.com',
      saltPassword:       'new-salt-p',
      wrappedDekPassword: { iv: 'new-iv', ct: 'new-ct' },
      newPassword:        'NuevaContraseña123',
    })

    // Auto-login: guardó JWT y cacheó crypto con userId real
    expect(store.token).toBe('tok-abc-123')
    expect(mockPersist).toHaveBeenCalledWith(
      mockUser.id,
      'new-salt-p',
      { iv: 'new-iv', ct: 'new-ct' },
    )
  })

  it('recoverComplete: si el backend rechaza, propaga el error y no guarda sesión', async () => {
    vi.mocked(AuthService.completeRecovery).mockRejectedValue({
      response: { data: { message: 'Email no encontrado' } },
    })
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:                  vi.fn(() => false),
      initSession:                 vi.fn(),
      persistPasswordCache:        vi.fn(),
      restoreSession:              vi.fn(),
      recoverWithPhrase:           vi.fn(),
      rotatePasswordAfterRecovery: vi.fn().mockResolvedValue({
        saltPassword:       's', wrappedDekPassword: { iv: 'i', ct: 'c' },
      }),
      clearSession:                vi.fn(),
      wipeSession:                 vi.fn(),
      isReady:                     false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await expect(store.recoverComplete('a@b.com', 'x')).rejects.toBeDefined()
    expect(store.error).toBe('Email no encontrado')
    expect(store.token).toBeNull()
  })
})

// ── Phase 2: login() — try primario + try secundario ───────────────────────────

describe('useAuthStore — login(): aislamiento E2EE', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  // Scenario 1 — happy path: backend OK + E2EE OK
  it('Scenario 1 — happy path: login resuelve, cryptoWarning null, token seteado', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    vi.fn(() => Promise.resolve()),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await store.login({ email: 'usuario@test.com', password: 'pass123' })

    // Login resolves without throwing (REQ-AS-LOGIN-07)
    expect(store.cryptoWarning).toBeNull()
    expect(store.error).toBeNull()
    expect(store.token).toBe('tok-abc-123')
    expect(store.loading).toBe(false)
  })

  // Scenario 2 — E2EE falla con Error genérico: login resuelve de todas formas
  it('Scenario 2 — crypto falla con Error: login resuelve, cryptoWarning seteado, token seteado', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    vi.fn(() => Promise.reject(new Error('WebCrypto no disponible'))),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()

    // login() debe resolver sin relanzar (REQ-AS-LOGIN-07)
    await expect(store.login({ email: 'usuario@test.com', password: 'pass123' })).resolves.toBeUndefined()

    expect(store.cryptoWarning).toBe('WebCrypto no disponible')   // REQ-AS-LOGIN-05
    expect(store.error).toBeNull()                                 // REQ-AS-LOGIN-06
    expect(store.token).toBe('tok-abc-123')                       // REQ-AS-LOGIN-03: token persistido
    expect(store.loading).toBe(false)
  })

  // Scenario 2b — E2EE falla con DOMException: login resuelve, mensaje específico
  it('Scenario 2b — crypto falla con DOMException: login resuelve, cryptoWarning con mensaje DOMException', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    // canRestore=true → va por restoreSession que lanza DOMException
    // wipeSession limpia, luego initSession también lanza DOMException
    const mockWipeSession = vi.fn()
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => true),
      initSession:    vi.fn(() => Promise.reject(new DOMException('op failed', 'OperationError'))),
      restoreSession: vi.fn(() => Promise.reject(new DOMException('unwrap failed', 'OperationError'))),
      clearSession:   vi.fn(),
      wipeSession:    mockWipeSession,
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await expect(store.login({ email: 'usuario@test.com', password: 'pass123' })).resolves.toBeUndefined()

    // El mensaje para DOMException es el específico (design §2.5)
    expect(store.cryptoWarning).toBe(
      'No se pudo restaurar tu cifrado local. Volvé a intentar o continuá sin cifrado en este dispositivo.'
    )
    expect(store.error).toBeNull()
    expect(store.token).toBe('tok-abc-123')
    // wipeSession debe haberse llamado como parte del recovery en _initOrRestoreCrypto
    expect(mockWipeSession).toHaveBeenCalled()
  })

  // Scenario 5 — backend falla (401): login relanza, crypto NO corre
  it('Scenario 5 — backend 401: login relanza, error seteado, crypto no corre, cryptoWarning null', async () => {
    const backendError = { response: { data: { message: 'Credenciales inválidas' } } }
    vi.mocked(AuthService.login).mockRejectedValue(backendError)

    const mockInitSession = vi.fn(() => Promise.resolve())
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    mockInitSession,
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()

    // login() debe relanzar cuando el backend falla (REQ-AS-LOGIN-08)
    await expect(store.login({ email: 'usuario@test.com', password: 'pass123' })).rejects.toBe(backendError)

    expect(store.error).toBe('Credenciales inválidas')   // REQ-AS-LOGIN-08
    expect(store.token).toBeNull()                        // REQ-AS-LOGIN-08: sin token
    expect(store.user).toBeNull()                         // REQ-AS-LOGIN-08: sin usuario
    expect(store.cryptoWarning).toBeNull()                // REQ-AS-LOGIN-08: cryptoWarning intacto
    // El crypto NO debe haberse ejecutado (REQ-AS-LOGIN-09)
    expect(mockInitSession).not.toHaveBeenCalled()
    expect(store.loading).toBe(false)
  })

  // Scenario 6 — error de red: login relanza, error genérico, crypto no corre
  it('Scenario 6 — error de red: login relanza, error desconocido, cryptoWarning null', async () => {
    const networkError = new Error('Network Error')
    vi.mocked(AuthService.login).mockRejectedValue(networkError)

    const mockInitSession = vi.fn(() => Promise.resolve())
    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    mockInitSession,
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    await expect(store.login({ email: 'usuario@test.com', password: 'pass123' })).rejects.toBe(networkError)

    // Error de red sin .response → 'Error desconocido'
    expect(store.error).toBe('Error desconocido')
    expect(store.token).toBeNull()
    expect(store.cryptoWarning).toBeNull()
    expect(mockInitSession).not.toHaveBeenCalled()
    expect(store.loading).toBe(false)
  })

  // Scenario 12 — segundo login limpia cryptoWarning previo
  it('Scenario 12 — segundo login resetea cryptoWarning previo al inicio (REQ-AS-LOGIN-01)', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse)

    vi.mocked(useCryptoStore).mockReturnValue({
      canRestore:     vi.fn(() => false),
      initSession:    vi.fn(() => Promise.resolve()),
      restoreSession: vi.fn(() => Promise.resolve()),
      clearSession:   vi.fn(),
      wipeSession:    vi.fn(),
      isReady:        false,
    } as unknown as ReturnType<typeof useCryptoStore>)

    const store = useAuthStore()
    // Simular estado degradado previo (primer login tuvo fallo E2EE)
    ;(store as unknown as Record<string, unknown>).cryptoWarning = 'warning del login anterior'
    expect(store.cryptoWarning).toBe('warning del login anterior')

    // Segundo login con E2EE OK — cryptoWarning debe quedar en null al finalizar
    await store.login({ email: 'usuario@test.com', password: 'pass123' })

    expect(store.cryptoWarning).toBeNull()
    expect(store.error).toBeNull()
  })
})
