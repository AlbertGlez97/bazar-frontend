// Lo que pinta la pantalla de resultado del cobro (`SaleResult`). Es una vista
// plana del `CheckoutResult` del store: los componentes de ui/ no dependen de
// stores, ni siquiera en tipos. `views/sales/sale-result.ts` hace el mapeo.

export type SaleResultView =
  /** Venta cobrada; totales del SERVIDOR. */
  | { kind: 'success'; totalMinor: number; changeMinor: number; summary?: string }
  /** Guardada en el dispositivo; se manda sola. Debe sentirse como éxito. */
  | { kind: 'saved-offline'; totalMinor: number; changeMinor: number }
  /** NO se cobró (perdió la carrera por la última pieza): pantalla propia, nunca de éxito. */
  | { kind: 'conflict'; message: string; detail?: string | null }
  /** El servidor no la aceptó; el carrito sigue intacto. */
  | { kind: 'rejected'; message: string }
  /** Sesión vencida: la venta está a salvo en el dispositivo. */
  | { kind: 'auth-needed'; message: string; totalMinor: number; changeMinor: number }
  /** Ni siquiera se pudo guardar en el dispositivo; el carrito sigue intacto. */
  | { kind: 'failed-to-save'; message: string }
  /** No se intentó cobrar (red de seguridad: la UI ya apaga el botón). */
  | { kind: 'blocked'; message: string }

export type SaleResultKind = SaleResultView['kind']
