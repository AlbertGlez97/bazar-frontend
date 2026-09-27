# Reglas de negocio: bazar-frontend

Reglas de negocio propias del frontend, o brechas conocidas entre lo que el backend ya soporta y lo que la
interfaz todavía conecta. Para las reglas del dominio en sí (ventas, productos, socios, comisiones, etc.) la
fuente de verdad es `bazar-api/doc/reglas-de-negocio.md`; este archivo no las repite, salvo cuando el
frontend deja algo explícitamente sin implementar y conviene que quede a la vista, no enterrado en un
comentario de código que nadie vuelve a leer.

## Pendiente explícito: Deuda (fiado y apartados)

**El flujo de venta actual (`SaleView.vue`, `cart.store.ts`, `checkout.store.ts`) no tiene ninguna opción
para registrar una venta como "fiado" o "apartado" (Deuda).** Hoy solo existe venta al contado: si el
efectivo recibido no alcanza el total, `cart.store` bloquea "Cobrar" y no hay ningún camino alternativo para
salir con el producto y una deuda pendiente.

Esto **no es una limitación del backend** — es una brecha del frontend que puede olvidarse si no queda
anotada en algún lado:

- El backend soporta Deuda por completo desde **BE-09**: 4 endpoints estables (`POST /deudas`,
  `GET /deudas`, `GET /deudas/:id`, `POST /deudas/:id/abonos`), modelos Prisma `Deuda`/`Abono`/`Deudor`,
  reglas documentadas en `bazar-api/doc/reglas-de-negocio.md` (sección "Fiado y apartados (Deuda)") y
  pruebas e2e (`bazar-api/test/deudas.e2e-spec.ts`).
- El contrato para que el frontend lo consuma **ya está escrito**, no hay que negociarlo con el backend:
  ver `doc/api-contract-for-frontend.md`, sección 10 "Deudas".
- Búsqueda hecha al redactar esta nota: cero referencias a `deuda`, `fiado`, `apartado` o `abono` en
  `bazar-frontend/src`. La única mención existente es un comentario de alcance futuro en
  `src/layouts/nav-items.ts` ("una futura sección: Comisiones, Deudas"), que no cuenta como implementación.

**Cuando se decida construir esto**, es un flujo nuevo, no una casilla más en el checkout al contado: un solo
producto y cantidad por deuda (no un carrito completo), solo un socio puede autorizarla, cualquier Member
puede registrar abonos, y no hay endpoint para editarla ni cancelarla — ver el contrato citado arriba antes
de diseñar la UI, para no inventar una forma que el backend no soporta.
