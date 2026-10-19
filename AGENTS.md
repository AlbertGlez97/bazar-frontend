# Reglas de revisión — bazar-frontend (Vue 3, Pinia, Vitest)

Revisa solo lo que cambió. Responde STATUS: PASSED si cumple todo; STATUS: FAILED y la lista de problemas si no.

## Debe cumplir
- Diseño atómico: átomos en `ui/atoms`, moléculas en `ui/molecules`, organismos en `ui/organisms`. Un átomo no importa moléculas; una molécula no importa organismos; nada de `ui/` importa stores ni servicios.
- Importar componentes desde el barrel `@/components`.
- Todo `input`, `select` y `textarea` (también los ocultos y los de archivo) lleva `id` y su `label` enlazado (`for`), y un `autocomplete` válido para su tipo.
- Sin `NOSONAR`, sin `eslint-disable` para silenciar reglas, sin bajar umbrales ni excluir código de Sonar.
- Sin expresiones regulares con cuantificadores anidados o ambiguos (retroceso super-lineal).
- Texto para personas usuarias en español, frases cortas (20 palabras o menos en la ayuda).
- Un colaborador no ve costos ni acciones de gestión.
- Código nuevo con pruebas (Vitest); cobertura de código nuevo ≥ 80 %.
- Sin secretos ni claves en el código; el CSS usa los tokens de `main.css`, sin colores fijos.
- Saltos de línea consistentes (LF en el repositorio); sin `\r` dobles.
