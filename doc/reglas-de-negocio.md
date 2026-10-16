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

## Métodos de pago: lo que el backend ya soporta y la interfaz debe conectar

**El backend registra desde hoy tres métodos de pago (`EFECTIVO`, `TRANSFERENCIA`, `TARJETA`) en ventas y
abonos de fiado/apartado.** La regla del dominio vive en `bazar-api/doc/reglas-de-negocio.md` (sección
"Métodos de pago") y el contrato en `doc/api-contract-for-frontend.md`; aquí solo queda lo que le toca al
frontend. Mientras la interfaz no lo conecte, todo sigue siendo efectivo (el backend toma un método ausente
como `EFECTIVO`), así que nada se rompe al desplegar solo el backend.

Reglas que la interfaz debe respetar al construirlo:

- **Orden de despliegue**: el backend va primero. `POST /sales` y `POST /deudas` rechazan con 400 los campos
  desconocidos; el frontend no debe mandar `paymentMethod`/`abonoInicialPaymentMethod` antes de que el
  backend que los acepta esté en producción.
- **Efectivo**: se conserva el flujo de hoy (efectivo recibido, "Justo", cambio). `cashReceivedMinor` solo se
  manda con `EFECTIVO`.
- **Transferencia y tarjeta**: se cobra el total completo. **No se pide efectivo recibido ni se muestra
  cambio, y `cashReceivedMinor` no se manda** (enviarlo, incluso `0`, es 400). La respuesta trae
  `cashReceivedMinor` y `changeMinor` en `null`: el comprobante no debe pintarlos como `$0.00`.
- **Cola offline**: las ventas ya encoladas por una versión anterior no traen el campo y se reenvían igual
  (el backend las toma como `EFECTIVO` y un reenvío nunca da 409). Una venta nueva encolada con
  `TRANSFERENCIA`/`TARJETA` debe guardar su método en la cola para reenviarlo idéntico; cambiar el método de
  una venta ya encolada es otro payload (409 si ya llegó al servidor).
- **Abonos**: el abono inicial de `POST /deudas` usa `abonoInicialPaymentMethod` y cada
  `POST /deudas/:id/abonos` usa `paymentMethod` (ambos opcionales, por defecto `EFECTIVO`). El método no
  cambia saldo ni estado y **no se edita después**.
- **Reporte**: `GET /reports/sales-by-period` devuelve `porMetodoPago` con las tres llaves siempre. La suma de
  los tres `totalMinor` es `totalIngresadoMinor`; sirve para mostrar dónde está el dinero (caja, cuenta
  bancaria, terminal). Comisiones y ganancia no dependen del método.
- **No hay folio ni referencia de la terminal**: la interfaz no debe pedirlos.
