# Marca, presentación, descripción, "Crear otro igual" y ficha por QR

Requiere el backend con la migración `20261019120000_product_brand_presentation_description` (el backend se despliega primero). Detalle del servidor: `bazar-api/doc/product-descriptors.md`.

## Datos del producto
- `brand` (40), `presentation` (40; talla, tamaño o capacidad, el color va dentro: "Azul · 28") y `description` (200). Todos opcionales; ausentes = `null`.
- Formulario (`ProductForm`): `AppSuggestInput` (lista nativa de sugerencias, ayuda corta, contador) y `AppTextarea` con contador. Solo los socios piden las sugerencias (`GET /products/suggestions`); sin ellas el campo es de texto libre.
- Al editar solo se manda lo que cambió; vaciar un campo manda `null`.
- Un colaborador **no recibe** `purchaseCostMinor` (el servidor omite la clave): el tipo `Product` lo tiene opcional.

## Dónde se ve "Marca · Presentación"
Tarjeta y fila (Gestión y Venta), carrito (y su nombre accesible), búsqueda local de Venta (también busca por marca y presentación), filtro **Marca** del panel (URL `?marca=`), reportes por producto (pantalla, PDF y Excel como "Nombre (Marca · Presentación)"), formulario de reposición y etiquetas QR.

Etiqueta 35 × 25 mm: con presentación, el nombre se queda en un renglón y la presentación va en el segundo de los dos reservados; el tamaño del QR y la calibración no cambian.

## Crear otro igual
Solo socios, no en Modo Venta: tarjeta, fila y modal de edición. Copia nombre, tipo, marca, categoría, precio, costo, proveedor, notas y descripción; deja vacías la presentación y la existencia y enfoca Presentación. La foto se baja y se sube como archivo nuevo (nunca se comparte la ruta); si falla: "No pudimos copiar la foto" y el producto queda creado. "Guardar y crear otro igual" guarda y abre el siguiente ya precargado.

## Ficha por QR (`ProductSheet`)
- Venta: el escáner tiene "Agregar a la venta | Ver ficha". Siempre abre en "Agregar" (no persiste). En "Ver ficha": vibración corta, ficha encima del escáner con "Agregar a la venta" y "Escanear otro"; no agrega nada solo. Funciona sin conexión (catálogo local).
- Productos (socios): botón "Escanear QR", modo ficha fijo; la ficha muestra costo, Editar y Reponer. Necesita conexión.
- Colaboradores: la ficha no muestra costo ni acciones de gestión.
- Varios modales a la vez: `useModalStack` (Escape y bloqueo del scroll son del de arriba).
