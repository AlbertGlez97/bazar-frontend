import { describe, it, expect } from 'vitest'
import { describeApiError, describeFailure, withStatusSuffix } from '../api-error'
import { VOICE } from '@/config/voice'

/** Minimal axios-like error: what `api` rejects with when the server answers. */
function httpError(status: number, data?: unknown) {
  return { isAxiosError: true, response: { status, data }, message: `Request failed with status code ${status}` }
}

/** Axios error with no response: network down, CORS, DNS, timeout... */
const noResponse = () => ({ isAxiosError: true, request: {}, message: 'Network Error' })

describe('describeApiError', () => {
  describe('no server answer', () => {
    it('network error (axios without response) -> the shared network copy and no status', () => {
      const described = describeApiError(noResponse())
      expect(described).toMatchObject({ kind: 'network', status: null, message: VOICE.networkError })
    })

    it('a non-axios value (plain Error, string, undefined) -> generic copy and no status, never throws', () => {
      for (const value of [new Error('boom'), 'boom', undefined, null, 42, {}]) {
        const described = describeApiError(value)
        expect(described.status).toBeNull()
        expect(described.message).toBe(VOICE.genericError)
      }
    })
  })

  describe('401', () => {
    it('says the session expired and does not try to log out (the interceptor does)', () => {
      const described = describeApiError(httpError(401, { message: 'Unauthorized' }))
      expect(described).toMatchObject({ kind: 'session', status: 401 })
      expect(described.message).toContain('sesión')
    })
  })

  describe('403', () => {
    it('"Only socios may access this resource" -> only socios can change the catalog', () => {
      const described = describeApiError(httpError(403, { message: 'Only socios may access this resource', error: 'Forbidden', statusCode: 403 }))
      expect(described).toMatchObject({ kind: 'not-socio', status: 403 })
      expect(described.message).toBe(VOICE.apiErrors.notSocio)
      expect(described.message).toContain('socios')
    })

    it('"Selection is not authorized for this context" -> the device/person is no longer recognised (stale device after a wipe, revoked, wrong token)', () => {
      const described = describeApiError(httpError(403, { message: 'Selection is not authorized for this context', error: 'Forbidden', statusCode: 403 }))
      expect(described).toMatchObject({ kind: 'context-lost', status: 403 })
      expect(described.message).toBe(VOICE.apiErrors.contextLost)
    })

    it('any other 403 -> a plain "no permission" copy', () => {
      const described = describeApiError(httpError(403, { message: 'Something else' }))
      expect(described).toMatchObject({ kind: 'forbidden', status: 403, message: VOICE.apiErrors.forbidden })
    })

    it('403 with an empty or HTML body still classifies as forbidden', () => {
      expect(describeApiError(httpError(403, '')).kind).toBe('forbidden')
      expect(describeApiError(httpError(403, '<html><body>Forbidden</body></html>')).kind).toBe('forbidden')
      expect(describeApiError(httpError(403, undefined)).kind).toBe('forbidden')
    })
  })

  describe('400 (class-validator messages)', () => {
    const validation = (...messages: string[]) => describeApiError(httpError(400, { message: messages, error: 'Bad Request', statusCode: 400 }))

    it.each([
      ['category must be longer than or equal to 1 characters', 'categoría'],
      ['unitPriceMinor must be an integer number', 'precio'],
      ['unitPriceMinor must not be greater than 2147483647', 'precio'],
      ['unitPriceMinor must not be less than 0', 'precio'],
      ['name should not be empty', 'nombre'],
      ['name must be longer than or equal to 1 characters', 'nombre'],
      ['name must be shorter than or equal to 200 characters', 'nombre'],
      ['name must match /\\S/ regular expression', 'nombre'],
      ['initialStock must be an integer number', 'existencia'],
      ['initialStock must not be less than 0', 'existencia'],
      ['purchaseCostMinor must be an integer number', 'costo'],
      ['purchaseCostMinor must not be greater than 2147483647', 'costo'],
      ['tipo must be one of the following values: unica, cantidad', 'pieza única'],
    ])('known message "%s" -> friendly Spanish mentioning "%s"', (raw, keyword) => {
      const described = validation(raw)
      expect(described).toMatchObject({ kind: 'validation', status: 400 })
      expect(described.message.toLowerCase()).toContain(keyword)
      // Friendly: it is not the raw English validator text.
      expect(described.message).not.toContain('must')
    })

    it('BE-13 "purchaseCostMinor cannot be cleared once it has been set" -> the dedicated locked message, not the generic invalid-amount one', () => {
      const described = validation('purchaseCostMinor cannot be cleared once it has been set')
      expect(described.message).toBe(VOICE.apiErrors.product.purchaseCostLocked)
      expect(described.message).not.toBe(VOICE.apiErrors.product.purchaseCost)
    })

    it('several messages: the first known one leads and the rest stay available as detail', () => {
      const described = validation('unitPriceMinor must be an integer number', 'unitPriceMinor must not be less than 0', 'category must be longer than or equal to 1 characters')
      expect(described.message.toLowerCase()).toContain('precio')
      expect(described.detail).toContain('category')
    })

    it('an unknown message is shown raw (first one) so support can read it', () => {
      const described = validation('property imageFile should not exist', 'another')
      expect(described.kind).toBe('validation')
      expect(described.message).toContain('property imageFile should not exist')
    })

    it('a string message (not an array) works too', () => {
      const described = describeApiError(httpError(400, { message: 'At least one editable field is required' }))
      expect(described.kind).toBe('validation')
      expect(described.message).toContain('At least one editable field is required')
    })

    it('an empty/HTML/odd body falls back to a generic validation copy, never raw HTML', () => {
      for (const body of ['', undefined, null, '<html><body><h1>Bad</h1></body></html>', { message: [] }, { message: '' }, { message: 42 }, { message: [1, 2] }]) {
        const described = describeApiError(httpError(400, body))
        expect(described.kind).toBe('validation')
        expect(described.message).toBe(VOICE.apiErrors.invalid)
        expect(described.message).not.toContain('<')
      }
    })

    it('a very long raw message is capped', () => {
      const described = describeApiError(httpError(400, { message: ['x'.repeat(2000)] }))
      expect(described.message.length).toBeLessThanOrEqual(300)
    })
  })

  describe('other statuses', () => {
    it('404 -> it no longer exists, refresh', () => {
      expect(describeApiError(httpError(404, { message: 'Product not found' }))).toMatchObject({ kind: 'not-found', status: 404, message: VOICE.apiErrors.notFound })
    })

    it('409 with a server message -> that message; without -> generic conflict copy', () => {
      expect(describeApiError(httpError(409, { message: 'Ese nombre ya existe' }))).toMatchObject({ kind: 'conflict', status: 409, message: 'Ese nombre ya existe' })
      expect(describeApiError(httpError(409, { message: '' })).message).toBe(VOICE.apiErrors.conflict)
      expect(describeApiError(httpError(409, '<html></html>')).message).toBe(VOICE.apiErrors.conflict)
    })

    it.each([500, 502, 503, 504])('%i -> "the server had a problem"', (status) => {
      expect(describeApiError(httpError(status, { message: 'Internal server error' }))).toMatchObject({ kind: 'server', status, message: VOICE.apiErrors.server })
    })

    it('any other status (418, 429) -> generic copy but keeps the status', () => {
      expect(describeApiError(httpError(418, {}))).toMatchObject({ kind: 'unknown', status: 418, message: VOICE.genericError })
      expect(describeApiError(httpError(429, {}))).toMatchObject({ kind: 'unknown', status: 429 })
    })
  })

  describe('privacy', () => {
    it('never exposes tokens, request bodies or headers from the error object', () => {
      const error = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        config: { headers: { Authorization: 'Bearer SECRET-TOKEN', 'x-device-token': 'SECRET-DEVICE' }, data: '{"password":"hunter2"}' },
        response: { status: 400, data: { message: ['category must be longer than or equal to 1 characters'] } },
      }
      const described = describeApiError(error)
      const serialized = JSON.stringify(described)
      expect(serialized).not.toContain('SECRET')
      expect(serialized).not.toContain('hunter2')
    })
  })
})

describe('describeFailure', () => {
  it('joins the action and the real reason, with the code', () => {
    const { message, described } = describeFailure('No pudimos guardar el producto.', httpError(403, { message: 'Only socios may access this resource' }))
    expect(message).toBe(`No pudimos guardar el producto. ${VOICE.apiErrors.notSocio} (código 403)`)
    expect(described.kind).toBe('not-socio')
  })

  it('an error nobody can classify keeps the historical text and shows no code', () => {
    expect(describeFailure('No pudimos guardar el producto.', new Error('boom')).message).toBe('No pudimos guardar el producto. Intenta de nuevo.')
  })

  it('a network error names the network, without a code', () => {
    expect(describeFailure('No pudimos cargar tu catálogo.', noResponse()).message).toBe(`No pudimos cargar tu catálogo. ${VOICE.networkError}`)
  })
})

describe('withStatusSuffix', () => {
  it('appends the HTTP code for support when there is one', () => {
    expect(withStatusSuffix({ status: 403, message: 'Solo los socios.' })).toBe('Solo los socios. (código 403)')
  })

  it('leaves the message alone when there is no status (network)', () => {
    expect(withStatusSuffix({ status: null, message: 'Sin internet.' })).toBe('Sin internet.')
  })
})
