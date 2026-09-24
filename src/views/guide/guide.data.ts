// Contenido de la Guía Financiera. Cada artículo declara sus secciones y fuentes.
// Fuentes verificadas de CONDUSEF, Banxico y BBVA México al escribir este archivo.

export type GuideCategory = 'conceptos' | 'sistema' | 'seguridad'

export interface GuideSection {
  heading?: string
  paragraphs?: string[]
  /** Bloque de nota/callout — se renderiza destacado */
  callout?: { kind: 'info' | 'warn' | 'tip'; text: string }
  /** Bloque de ejemplo numérico — render con estilo code-like */
  example?: { title: string; lines: string[] }
  list?: string[]
}

export interface GuideSource {
  label: string
  url:   string
  /** Institución emisora — se muestra como badge */
  org:   'CONDUSEF' | 'Banxico' | 'Profeco' | 'BBVA' | 'INCIBE' | 'OSI' | 'Proton' | 'Otro'
}

export interface GuideArticle {
  slug:       string
  category:   GuideCategory
  title:      string
  readTime:   string           // "3 min", "5 min"
  summary:    string           // 1-2 líneas para el índice
  sections:   GuideSection[]
  sources:    GuideSource[]
  /** slugs de artículos relacionados */
  related?:   string[]
}

export const CATEGORIES: Record<GuideCategory, { icon: string; title: string; description: string }> = {
  conceptos: {
    icon:        '📚',
    title:       'Conceptos financieros',
    description: 'Entiende los fundamentos antes de tomar decisiones.',
  },
  sistema: {
    icon:        '🛠️',
    title:       'Cómo usar el sistema',
    description: 'Tutoriales paso a paso para sacarle provecho.',
  },
  seguridad: {
    icon:        '🔒',
    title:       'Seguridad y privacidad',
    description: 'Cómo protegemos tus datos y qué implica para ti.',
  },
}

// ── ARTÍCULOS ────────────────────────────────────────────────────────────────

export const ARTICLES: GuideArticle[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'capital-vs-interes',
    category: 'conceptos',
    title:    'Capital vs interés: entiende la diferencia',
    readTime: '4 min',
    summary:  'Cuando pagas tu tarjeta, una parte va al capital y otra al banco. Saber cuál es cuál cambia todo.',
    sections: [
      {
        paragraphs: [
          'Cuando contratas un crédito o usas tu tarjeta, asumes una deuda que está compuesta por DOS cosas distintas: el capital (lo que realmente pediste prestado) y el interés (lo que le cobran por prestártelo). Mezclarlas es el error más común al manejar finanzas personales — y el más caro.',
        ],
      },
      {
        heading: '¿Qué es el capital?',
        paragraphs: [
          'El capital es el monto original de tu deuda. Si compraste algo de $20,000 con la tarjeta, ese es tu capital inicial. A medida que haces pagos, el capital se va reduciendo — pero solo si el pago supera los intereses del periodo.',
        ],
      },
      {
        heading: '¿Qué es el interés?',
        paragraphs: [
          'El interés es el costo de tener la deuda. El banco te cobra un porcentaje sobre el capital pendiente cada mes. Si tu tasa anual es 60%, el interés mensual aproximado es 5% del saldo pendiente.',
          'El interés NO reduce tu deuda — es un gasto. Por eso al pagar el mínimo la deuda parece no bajar: la mayor parte de ese pago se va al banco como interés.',
        ],
        callout: {
          kind: 'warn',
          text: 'CONDUSEF lo dice claro: "al pagar el mínimo de una tarjeta se abona entre el 5 y 10% de la deuda total, por lo tanto la cuenta no disminuye, ya que los pagos se componen en mayor parte de comisiones, intereses y gastos administrativos".',
        },
      },
      {
        heading: 'Ejemplo concreto',
        paragraphs: [
          'Imagina una deuda de $20,000 con 60.5% de tasa anual. Pagas $1,200 este mes.',
        ],
        example: {
          title: 'Desglose del pago de $1,200',
          lines: [
            'Interés del mes  = $20,000 × (60.5% / 12)  = $1,008.33',
            'Capital pagado   = $1,200 − $1,008.33     = $191.67',
            '',
            'Resultado:',
            '• Al banco se fueron:     $1,008.33 (interés — no reduce deuda)',
            '• Tu capital bajó a:      $19,808.33',
            '',
            'De los $1,200 que pagaste, solo $191.67 redujeron la deuda.',
          ],
        },
      },
      {
        heading: '¿Cómo lo modela esta app?',
        paragraphs: [
          'Cuando agregas una deuda, el campo "Capital inicial" es tu capital sin intereses. El sistema calcula el interés mensual sobre el saldo pendiente usando la tasa anual que registraste. Por eso el "Total para liquidar hoy" que ves en el detalle es SIEMPRE mayor que tu capital: incluye el interés devengado del mes actual.',
        ],
        callout: {
          kind: 'tip',
          text: 'Regla de oro: si quieres que la deuda baje rápido, tu pago tiene que superar el interés mensual. Todo lo que pagues por encima se va al capital y acelera el progreso.',
        },
      },
    ],
    sources: [
      { label: '¿Sabes utilizar el pago mínimo a tu favor?', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx/?p=contenido&idc=951&idcat=1' },
      { label: '¿Qué pasa si solo pago el mínimo de mi tarjeta de crédito?', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/creditos/tarjeta-de-credito/que-pasa-si-solo-pago-el-minimo-de-mi-tdc.html' },
      { label: '¿Para qué sirve la tabla de amortización?', org: 'BBVA', url: 'https://www.bbva.mx/personas/educacion-financiera/para-que-sirve-la-tabla-de-amortizacion.html' },
      { label: 'Pagos mínimos en tarjetas: solo cuando sea necesario', org: 'Profeco', url: 'https://www.gob.mx/profeco/articulos/pagos-minimos-en-tarjetas-solo-cuando-sea-necesario' },
    ],
    related: ['tasa-anual-vs-mensual', 'desglose-pago'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'tasa-anual-vs-mensual',
    category: 'conceptos',
    title:    'Tasa anual, tasa mensual y CAT: no son lo mismo',
    readTime: '4 min',
    summary:  'Entiende por qué 60% anual NO es lo mismo que 5% mensual, y qué significa el CAT que ves en tu contrato.',
    sections: [
      {
        paragraphs: [
          'Los bancos te muestran varios números: tasa de interés anual, tasa mensual, y el famoso CAT. Muchos creen que son intercambiables. No lo son. Entender cada uno te ayuda a comparar créditos y a calcular cuánto te va a costar una deuda.',
        ],
      },
      {
        heading: 'Tasa anual',
        paragraphs: [
          'Es el porcentaje de interés que se cobra en un año. Si tu tarjeta tiene tasa anual de 60.5%, eso significa que por cada $100 que debes, en teoría pagarías $60.50 de interés al año.',
          'Pero los bancos no esperan un año para cobrarte — dividen la tasa anual entre 12 y te cobran una proporción cada mes.',
        ],
      },
      {
        heading: 'Tasa mensual',
        paragraphs: [
          'Es la tasa anual dividida entre 12 meses. Para una tasa anual del 60.5%, la mensual es aproximadamente 5.04%.',
        ],
        example: {
          title: 'Cálculo mensual',
          lines: [
            'Tasa anual:   60.5%',
            'Tasa mensual: 60.5% ÷ 12 = 5.04%',
            '',
            'Si debes $20,000:',
            'Interés del mes = $20,000 × 5.04% = $1,008.33',
          ],
        },
      },
      {
        heading: '¿Qué es el CAT?',
        paragraphs: [
          'El CAT (Costo Anual Total) es un indicador creado por Banxico que muestra el costo REAL de un crédito. No solo incluye la tasa de interés, sino también comisiones, seguros y otros gastos asociados.',
          'Por eso el CAT siempre es MAYOR que la tasa de interés anual. Es el número que tienes que mirar para comparar créditos entre bancos.',
        ],
        callout: {
          kind: 'info',
          text: 'Por ley, todas las instituciones financieras en México deben mostrar el CAT en sus productos de crédito. Incluso las tiendas departamentales.',
        },
      },
      {
        heading: 'Ejemplo de diferencia CAT vs tasa',
        paragraphs: [
          'Tarjeta con tasa de interés anual de 60%:',
        ],
        example: {
          title: 'CAT vs Tasa',
          lines: [
            'Tasa de interés anual:  60.00%',
            'Comisión anualidad:     agregada al cálculo',
            'Comisión por disposición: agregada al cálculo',
            'Seguros:                 agregados al cálculo',
            '',
            'CAT (estimado):          ~85% a 110%  ← el número real',
          ],
        },
      },
      {
        heading: 'Herramientas útiles',
        paragraphs: [
          'Banxico tiene calculadoras oficiales para comparar CATs entre créditos y tarjetas. Son gratuitas y están en las fuentes al final de este artículo.',
        ],
      },
    ],
    sources: [
      { label: 'CAT, GAT y tasas — Banco de México', org: 'Banxico', url: 'https://www.banxico.org.mx/sistema-financiero/cat-gat-tasas-banco-mexico.html' },
      { label: 'Calculadora oficial del CAT', org: 'Banxico', url: 'https://www.banxico.org.mx/CAT/' },
      { label: 'Calculadora CAT para tarjetas de crédito', org: 'Banxico', url: 'https://www.banxico.org.mx/CATWebTarjetas/' },
      { label: '¿Qué es el CAT de una tarjeta de crédito?', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/creditos/tarjeta-de-credito/que-es-el-cat-de-una-tarjeta-de-credito.html' },
      { label: 'Diferencias entre CAT y tasa de interés anual', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/creditos/tarjeta-de-credito/tdc-diferencias-cat-y-tasa-de-interes.html' },
      { label: '¿Sabes cuál es la tasa de interés y el CAT que te cobran?', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx/?p=contenido&idc=914&idcat=1' },
    ],
    related: ['capital-vs-interes', 'desglose-pago'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'msi-vs-deuda-revolvente',
    category: 'conceptos',
    title:    'MSI vs deuda con interés: no son lo mismo',
    readTime: '3 min',
    summary:  'Meses sin intereses y crédito revolvente se ven parecidos. Tratarlos igual es el camino más corto al sobreendeudamiento.',
    sections: [
      {
        paragraphs: [
          'Es muy común mezclar "compra a meses sin intereses" con "saldo de tarjeta". Son cosas distintas y tu app los modela como módulos separados por una razón: se comportan financieramente de forma diferente.',
        ],
      },
      {
        heading: 'Meses sin intereses (MSI)',
        paragraphs: [
          'Es una promoción: pagas el precio de contado dividido en N cuotas iguales (6, 12, 18 o más meses). Si respetas las mensualidades, NO se generan intereses. El costo final es EXACTAMENTE el precio del producto.',
        ],
        example: {
          title: 'Ejemplo: TV en 12 MSI',
          lines: [
            'Precio de contado:  $12,000',
            'Plan:               12 MSI',
            'Cuota mensual:      $1,000',
            '',
            'Pagando puntualmente:',
            'Total pagado:       $12,000 (mismo precio, sin interés)',
          ],
        },
      },
      {
        heading: 'Crédito revolvente (deuda de tarjeta)',
        paragraphs: [
          'Es el saldo que se acumula en tu tarjeta cuando no pagas el total mensual. Sobre ese saldo, el banco cobra intereses cada mes. No tiene plazo definido: tú decides cuánto pagar (arriba del mínimo) y cuánto tiempo tardas en liquidar.',
        ],
      },
      {
        heading: 'La trampa de mezclarlos',
        paragraphs: [
          'CONDUSEF lo explica así: "la mensualidad por comprar a meses sin intereses se agrega de manera adicional al pago mínimo que normalmente se te cobra por tu crédito revolvente". Es decir: MSI y saldo de tarjeta conviven en la misma tarjeta, pero cada uno con su lógica.',
          'Si no pagas la mensualidad del MSI, se convierte en saldo revolvente y EMPIEZA a generar intereses. Ahí el "sin intereses" deja de aplicar.',
        ],
        callout: {
          kind: 'warn',
          text: 'La promoción MSI es "sin intereses" SOLO si pagas puntualmente cada cuota. Un atraso convierte el saldo en deuda con tasa.',
        },
      },
      {
        heading: 'Cómo los manejamos aquí',
        list: [
          '📦 Módulo MSI: para tus compras a meses sin intereses. Reduce tu ingreso disponible del mes automáticamente mientras dure el plan.',
          '💳 Módulo Deudas: para saldos con tasa de interés — tarjetas no pagadas, préstamos personales, créditos de auto. Se calcula el interés mes a mes.',
        ],
        callout: {
          kind: 'tip',
          text: 'Regla simple: ¿tu compra tiene una tasa de interés? Regístrala en Deudas. ¿No genera interés mientras pagues a tiempo? Regístrala en MSI.',
        },
      },
    ],
    sources: [
      { label: '¡No te sobreendeudes! con los meses sin intereses', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx/?p=contenido&idc=890&idcat=1' },
      { label: 'Cuidado con los meses sin intereses en el Buen Fin', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx/index.php?p=contenido&idc=438&idcat=1' },
      { label: 'Revista Proteja su Dinero: Meses ¿sin intereses?', org: 'CONDUSEF', url: 'https://revista.condusef.gob.mx/credito/tarjeta/2012/05/meses-sin-intereses/' },
      { label: 'Resuelve tus dudas sobre los meses sin intereses', org: 'BBVA', url: 'https://www.bbva.mx/personas/productos/tarjetas-de-credito/meses-sin-intereses-bbva.html' },
    ],
    related: ['capital-vs-interes'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'desglose-pago',
    category: 'sistema',
    title:    'Registrar un pago y entender el desglose',
    readTime: '5 min',
    summary:  'Cada vez que registras un pago, la app calcula qué parte fue a interés y qué parte al capital. Aquí te explico cómo funciona y por qué importa.',
    sections: [
      {
        paragraphs: [
          'Registrar pagos bien es clave para que los números de tu panel de deudas sean fieles a la realidad. La app separa cada pago en dos partes: lo que se fue en interés (un gasto) y lo que amortizó capital (tu deuda real bajando).',
        ],
      },
      {
        heading: 'Paso 1 — Abre el detalle de la deuda',
        paragraphs: [
          'Desde el módulo Deudas, haz clic en la deuda a la que le quieres registrar un pago. Se abre la vista de detalle con tres tarjetas arriba: Saldo de capital, Costo por pagar (proyección) y Total para liquidar hoy.',
        ],
      },
      {
        heading: 'Paso 2 — Usa el botón "+ Registrar pago"',
        paragraphs: [
          'Pon el monto que efectivamente pagaste al banco (lo que aparece en tu cuenta), la fecha, y una nota opcional. El sistema hace el resto.',
        ],
      },
      {
        heading: 'Paso 3 — Así se calcula el desglose',
        example: {
          title: 'Tu deuda: $20,000 al 60.5% anual. Registras pago de $2,000.',
          lines: [
            '1) Interés del mes corriente (sobre el saldo actual):',
            '   $20,000 × (60.5% / 12) = $1,008.33',
            '',
            '2) Capital amortizado (el excedente sobre el interés):',
            '   $2,000 − $1,008.33 = $991.67',
            '',
            '3) Nuevo saldo de capital:',
            '   $20,000 − $991.67 = $19,008.33',
            '',
            'Al banco se fueron:         $1,008.33 (interés, gasto)',
            'Tu deuda real bajó a:       $19,008.33',
          ],
        },
      },
      {
        heading: 'Qué pasa si pagas menos que el interés',
        paragraphs: [
          'Si tu pago no cubre el interés del mes, el sistema detecta que NO hubo amortización y deja tu capital intacto. El interés pagado queda registrado como gasto, pero tu deuda no bajó.',
        ],
        callout: {
          kind: 'warn',
          text: 'Este es el escenario clásico de "pagar el mínimo y que la deuda no baje nunca". Si ves que tu capital no se mueve mes a mes, es porque tu pago equivale (o está por debajo) del interés generado.',
        },
      },
      {
        heading: 'Dónde ver el impacto global',
        paragraphs: [
          'En la pantalla principal de Deudas vas a ver cinco métricas con tooltips explicativos:',
        ],
        list: [
          'Capital total inicial: tu punto de partida real (solo deudas activas).',
          'Capital amortizado: cuánto capital redujiste con tus pagos.',
          'Capital restante: lo que realmente te queda por pagar.',
          'Intereses al banco: plata que se fue como costo. Si crece rápido, considera pagar más del mínimo.',
          'Pago mínimo/mes: obligación mensual para no caer en mora.',
        ],
      },
      {
        heading: 'Tip — para bajar la deuda más rápido',
        paragraphs: [
          'Cualquier peso extra por encima del interés mensual acelera la amortización exponencialmente. No hace falta triplicar el pago — incluso $500 extra al mes reducen meses de deuda y miles en intereses totales.',
        ],
      },
    ],
    sources: [
      { label: '¿Para qué sirve la tabla de amortización?', org: 'BBVA', url: 'https://www.bbva.mx/personas/educacion-financiera/para-que-sirve-la-tabla-de-amortizacion.html' },
      { label: 'Calcula los intereses de tu tarjeta con la app', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/creditos/tarjeta-de-credito/como-calcular-los-intereses-de-una-tarjeta-de-credito.html' },
      { label: '¿Sabes utilizar el pago mínimo a tu favor?', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx/?p=contenido&idc=951&idcat=1' },
      { label: 'Calculadora de Pagos Mínimos en Tarjeta de Crédito', org: 'CONDUSEF', url: 'https://phpapps.condusef.gob.mx/condusef_pagomin/index.php' },
    ],
    related: ['capital-vs-interes', 'tasa-anual-vs-mensual'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'estrategias-pago-deudas',
    category: 'conceptos',
    title:    'Estrategias para salir de deudas: Bola de Nieve, Avalancha y Fireball',
    readTime: '6 min',
    summary:  'Tres formas probadas de atacar tus deudas cuando tienes varias al mismo tiempo. Elige la que se adapte a ti.',
    sections: [
      {
        paragraphs: [
          'Cuando tienes más de una deuda, la pregunta no es solo "cuánto pago" sino "a CUÁL le pago primero". La respuesta cambia cuánto tiempo vas a tardar en salir y cuánta plata vas a terminar pagando en intereses.',
          'Existen tres estrategias probadas para esto. Ninguna es mágica, cada una tiene su lógica y su público ideal. Esta app las implementa las tres para que puedas compararlas.',
        ],
      },
      {
        heading: '❄️ Bola de Nieve (Snowball)',
        paragraphs: [
          'Propuesta por el economista Dave Ramsey. La idea: atacar primero la deuda MÁS CHICA, sin importar la tasa de interés. Cuando la liquidas, tomas ese pago que ya tenías asignado y lo sumas a la próxima deuda más chica. Y así.',
          'El nombre viene de la imagen: una bolita de nieve que arranca chica y va creciendo a medida que rueda. Tu capacidad de pago "rueda" de deuda en deuda, acumulándose.',
        ],
        example: {
          title: 'Ejemplo Bola de Nieve',
          lines: [
            'Tus deudas:',
            '  Tarjeta A:    $5,000  al 40%',
            '  Tarjeta B:    $12,000 al 60%',
            '  Préstamo C:   $30,000 al 15%',
            '',
            'Orden de ataque (menor saldo primero):',
            '  1° Tarjeta A ($5,000)',
            '  2° Tarjeta B ($12,000)',
            '  3° Préstamo C ($30,000)',
          ],
        },
        callout: {
          kind: 'tip',
          text: 'Fortaleza principal: PSICOLÓGICA. Liquidar una deuda entera al mes o dos te da una victoria visible y motivación para seguir. Ideal si te cuesta mantener la disciplina.',
        },
      },
      {
        heading: '🌊 Avalancha (Avalanche)',
        paragraphs: [
          'Estrategia matemáticamente óptima. Atacas primero la deuda con la TASA DE INTERÉS MÁS ALTA, sin importar el saldo. El razonamiento: cada peso que le tiras a la deuda más cara te ahorra más intereses futuros.',
          'Según BBVA y varios bancos, esta estrategia minimiza el total pagado en intereses a lo largo del tiempo. Es la respuesta que daría un contador.',
        ],
        example: {
          title: 'Ejemplo Avalancha',
          lines: [
            'Tus deudas:',
            '  Tarjeta A:    $5,000  al 40%',
            '  Tarjeta B:    $12,000 al 60%',
            '  Préstamo C:   $30,000 al 15%',
            '',
            'Orden de ataque (mayor tasa primero):',
            '  1° Tarjeta B   (60%)',
            '  2° Tarjeta A   (40%)',
            '  3° Préstamo C  (15%)',
          ],
        },
        callout: {
          kind: 'tip',
          text: 'Fortaleza principal: MATEMÁTICA. Pagas menos intereses totales y sales más rápido. El problema: si la deuda más cara también es la más grande, puedes pasar meses sin ver una victoria clara y perder motivación.',
        },
      },
      {
        heading: '🔥 Fireball (híbrido)',
        paragraphs: [
          'La Fireball no es una estrategia académica clásica — la popularizaron credit unions en EE.UU. como un balance entre las dos anteriores. La idea: separar tus deudas entre "caras" y "baratas" según un umbral de tasa, y atacar cada grupo con la estrategia que mejor le queda.',
          'Deudas con tasa ALTA → Avalancha (eficiencia matemática, porque ahí se te va la plata en intereses).',
          'Deudas con tasa BAJA → Bola de Nieve (motivación, porque a esa tasa el ahorro matemático es marginal).',
        ],
        callout: {
          kind: 'info',
          text: 'En nuestro sistema el umbral Fireball es 7% anual. Deudas con tasa > 7% se atacan con Avalancha (mayor tasa primero). Deudas con tasa ≤ 7% se atacan con Bola de Nieve (menor saldo primero). El 7% es un valor típico para distinguir "deuda cara" (tarjetas, créditos personales) de "deuda barata" (hipotecas, préstamos subsidiados).',
        },
      },
      {
        heading: '¿Cuál elegir?',
        list: [
          '🎯 Si tu problema es MOTIVACIÓN y necesitas victorias rápidas: Bola de Nieve.',
          '🧮 Si lo que te importa es minimizar cuánto pagas: Avalancha.',
          '⚖️ Si tienes mezcla de deudas caras y baratas y quieres balance: Fireball.',
          '💡 La diferencia real entre Avalancha y Snowball en plata total suele ser pequeña (5–15% según los casos). Más importante es la estrategia que puedas SOSTENER sin abandonar.',
        ],
      },
      {
        heading: 'Cómo se aplica en este sistema',
        paragraphs: [
          'En el modal de "Nueva deuda", cada deuda se registra con una estrategia preferida (❄️ snowball, 🌊 avalanche, 🔥 fireball). El sistema automáticamente calcula un orden de prioridad para todas tus deudas activas según la estrategia elegida.',
          'Ese "Orden de prioridad" aparece en el detalle de cada deuda y te dice cuál atacar primero. Además, en la vista principal de Deudas hay un tab "Comparador de estrategias" donde puedes ver, con TUS datos reales, cuántos meses y cuánto interés pagarías con cada método.',
        ],
        callout: {
          kind: 'tip',
          text: 'Tip práctico: cambiar de estrategia es gratis. Edita cualquier deuda, elige otra "Estrategia preferida" y el orden de prioridad se recalcula automáticamente. Prueba las tres en el comparador antes de decidir.',
        },
      },
    ],
    sources: [
      { label: 'Cómo salir de deudas: guía práctica en 5 pasos', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/blog/como-salir-de-deudas.html' },
      { label: 'Cómo saldar deudas y llegar a fin de mes (snowball vs avalanche)', org: 'BBVA', url: 'https://www.bbva.com/es/salud-financiera/como-saldar-deudas-y-llegar-a-fin-de-mes/' },
      { label: 'Plan de pagos: opciones para liquidar tus deudas', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/creditos/credito-de-nomina-prestamo/ppi-plan-de-pagos-deudas.html' },
      { label: '¿Cómo salir de una deuda?', org: 'Profeco', url: 'https://www.gob.mx/profeco/articulos/como-salir-de-una-deuda' },
      { label: 'Planificación financiera personal: manual para organizarlas', org: 'BBVA', url: 'https://www.bbva.com/es/salud-financiera/manual-para-organizar-las-finanzas-personales/' },
    ],
    related: ['desglose-pago', 'capital-vs-interes'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'regla-50-30-20',
    category: 'conceptos',
    title:    'Regla 50/30/20: distribuye tu ingreso sin vivir sufriendo',
    readTime: '3 min',
    summary:  'Una fórmula simple para organizar tu plata entre necesidades, gustos y ahorro. Usada por bancos y asesores del mundo.',
    sections: [
      {
        paragraphs: [
          'La regla 50/30/20 es una de las fórmulas más usadas en educación financiera. Su objetivo: dividir tu ingreso mensual entre las cosas que tienes que pagar, las que quieres disfrutar, y lo que vas a guardar o pagar de deudas.',
        ],
      },
      {
        heading: 'Los 3 bloques',
        list: [
          '🏠 50% Necesidades: renta, servicios (luz, agua, gas, internet), transporte, comida básica, seguros obligatorios. Lo que NO podrías dejar de pagar sin que tu vida se complique.',
          '🎯 30% Deseos: salidas, streaming, ropa no esencial, restaurantes, hobbies, suscripciones. Lo que eliges, no lo que necesitas.',
          '💎 20% Ahorro e inversión: fondo de emergencia, metas de ahorro, y/o pago extra de deudas (por encima del mínimo).',
        ],
      },
      {
        heading: 'Ejemplo con ingreso de $20,000',
        example: {
          title: 'Distribución 50/30/20',
          lines: [
            'Ingreso mensual:              $20,000',
            '',
            'Necesidades (50%):            $10,000',
            '  renta, servicios, despensa, transporte',
            '',
            'Deseos (30%):                 $6,000',
            '  streaming, salidas, ropa, gustos',
            '',
            'Ahorro/deudas extra (20%):    $4,000',
            '  fondo de emergencia + pagos arriba del mínimo',
          ],
        },
      },
      {
        heading: '¿Y si no me alcanza para el 50%?',
        paragraphs: [
          'Es la realidad de mucha gente. La regla es una guía, no una prisión. Si tus necesidades se comen 70% de tu ingreso, dos caminos: reducir gastos fijos (revisar servicios, replantear renta) o aumentar ingreso. Lo que NO funciona es sacrificar el ahorro o endeudarse para cubrir deseos.',
        ],
        callout: {
          kind: 'tip',
          text: 'Si estás pagando deudas con intereses altos (tipo tarjetas al 60%+), el 20% de ahorro puedes destinarlo completo a pagar esas deudas más rápido. Es "ahorrar interés" — que matemáticamente equivale a invertir al mismo porcentaje.',
        },
      },
      {
        heading: 'Cómo lo aplica esta app',
        paragraphs: [
          'En el detalle de tu presupuesto vas a ver el tab "Resumen 50/30/20" con los tres bloques pintados. Cada categoría de gasto variable se puede marcar como necesidad o deseo, y el sistema calcula automáticamente el porcentaje actual versus el objetivo.',
          'Si ves que estás en 70/20/10, no es fracaso — es información valiosa para replantear la distribución.',
        ],
      },
    ],
    sources: [
      { label: '¿Qué es la regla 50/30/20 y cómo funciona?', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/ahorro/ahorro/regla-50-30-20-de-ahorro.html' },
      { label: 'La regla 50/30/20: fórmula sencilla para ahorrar', org: 'BBVA', url: 'https://www.bbva.com/es/salud-financiera/la-regla-50-30-20-una-formula-sencilla-para-lograr-ahorrar-y-controlar-gastos/' },
      { label: 'Calculadora de presupuesto 50/30/20', org: 'BBVA', url: 'https://www.bbva.com/es/salud-financiera/calculadora-presupuesto-ahorro-mensual-50-30-20/' },
      { label: 'Paso a paso para un plan de ahorro mensual', org: 'BBVA', url: 'https://www.bbva.mx/educacion-financiera/ahorro/ahorro/que-es-un-plan-de-ahorro-mensual.html' },
      { label: 'Educa tu cartera — plataforma de educación financiera', org: 'CONDUSEF', url: 'https://webappsos.condusef.gob.mx/EducaTuCartera/index.html' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECCIÓN: SEGURIDAD Y PRIVACIDAD
  // ═══════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'que-es-e2ee',
    category: 'seguridad',
    title:    '¿Qué es el cifrado de extremo a extremo y por qué importa?',
    readTime: '5 min',
    summary:  'Tus datos financieros están protegidos con la misma tecnología que usan Signal, Proton y WhatsApp. Ni el servidor puede leerlos.',
    sections: [
      {
        paragraphs: [
          'Cuando usas una app que guarda información sensible en la nube, normalmente confías en que "la empresa" la protege bien. Pero históricamente muchas empresas fueron hackeadas, empleados internos filtraron datos, o gobiernos pidieron info por orden judicial. Tus datos quedaron expuestos aunque tú hicieras todo bien.',
          'El cifrado de extremo a extremo (E2EE) resuelve esto de raíz: la empresa NUNCA puede leer tus datos, aunque quisiera. Si la base de datos se filtra, lo que los atacantes ven es basura criptográfica ilegible.',
        ],
      },
      {
        heading: '¿Cómo funciona, en simple?',
        paragraphs: [
          'Cuando creas tu cuenta, en tu navegador (no en el servidor) se genera una llave criptográfica única que solo tú tienes. Todos tus datos (montos, saldos, notas de deudas, transacciones) se cifran con esa llave ANTES de viajar al servidor.',
          'El servidor solo ve blobs cifrados. Sin tu contraseña, no se pueden descifrar. Ni siquiera nosotros, los dueños de la app, podemos leerlos.',
        ],
        callout: {
          kind: 'info',
          text: 'INCIBE (Instituto Nacional de Ciberseguridad de España) lo define así: "el cifrado extremo a extremo es cuando envías un mensaje, solo tú y el receptor lo puede ver, nadie más, ni siquiera la empresa desarrolladora de la aplicación".',
        },
      },
      {
        heading: 'Ejemplo con tus datos',
        paragraphs: [
          'Supongamos que registras una deuda: "Tarjeta BBVA, $20,000 al 60.5%". Así se ve la cadena:',
        ],
        example: {
          title: 'El camino de tus datos',
          lines: [
            'En tu navegador:',
            '  { monto: 20000, tasa: 60.5 }            ← texto plano',
            '  ↓ se cifra localmente con tu llave',
            '  { iv: "f3a2...", ct: "9b8e2c..." }       ← basura cifrada',
            '',
            'Viaja al servidor:',
            '  POST /debts  body: { iv, ct, ... metadata }',
            '',
            'En nuestra base de datos (PostgreSQL):',
            '  INSERT INTO debts VALUES ({iv,ct}, ...)  ← se guarda cifrado',
            '',
            'Si alguien hackea la DB:',
            '  SELECT * FROM debts                      ← ve {iv,ct} ilegibles',
          ],
        },
      },
      {
        heading: 'El modelo Zero-Knowledge',
        paragraphs: [
          'Nuestra app implementa específicamente un modelo llamado "Zero-Knowledge" (conocimiento cero). Significa que el servidor literalmente NO TIENE la información necesaria para descifrar tus datos. No es una promesa — es una imposibilidad matemática.',
          'Proton (la empresa detrás de ProtonMail y Proton Pass) describe este mismo modelo: "todo permanece cifrado en tu dispositivo, y ni siquiera los ingenieros de Proton pueden acceder a tus datos debido al modelo zero-knowledge".',
        ],
      },
      {
        heading: 'Qué cubre y qué NO cubre',
        paragraphs: [
          'Ser honesto aquí es importante. El E2EE cubre MUCHO, pero no todo:',
        ],
        list: [
          '✅ Volcado de la base de datos: ilegible sin tu contraseña.',
          '✅ Administrador malicioso del servidor: no puede leer tus datos.',
          '✅ Orden judicial al servidor: matemáticamente no hay datos útiles para entregar.',
          '✅ Ataques "man in the middle" sobre HTTPS: doble capa de cifrado.',
          '✅ Olvido de contraseña: recuperable con tu Kit de Emergencia de 12 palabras.',
          '❌ Malware o keylogger en TU dispositivo: puede leer tus datos en RAM.',
          '❌ Contraseña débil o filtrada: si alguien la consigue, puede descifrar.',
          '❌ Pérdida de contraseña Y de la frase de recuperación: sin ambas, no hay vuelta.',
        ],
        callout: {
          kind: 'warn',
          text: 'El eslabón más débil en cualquier sistema E2EE es SIEMPRE la contraseña del usuario. Por eso hay un artículo entero dedicado a cómo manejarla bien — y otro sobre cómo guardar tu Kit de Emergencia.',
        },
      },
      {
        heading: 'Detalles técnicos (para quien quiera profundizar)',
        list: [
          'Cifrado: AES-256-GCM (estándar de la industria, usado por bancos y gobiernos).',
          'Derivación de llave: PBKDF2 con 310,000 iteraciones (recomendación OWASP para 2023+).',
          'Jerarquía de llaves: KEK/DEK (Key Encrypting Key / Data Encryption Key). Permite cambiar la contraseña sin re-cifrar todos los datos.',
          'Protección anti-replay: AAD (Additional Authenticated Data) vincula cada blob a su registro específico.',
        ],
      },
    ],
    sources: [
      { label: 'Cifrado de la información', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/tematicas/cifrado' },
      { label: 'Tipos de cifrado para proteger tu privacidad en Internet', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/blog/sabias-que-existen-distintos-tipos-de-cifrado-para-proteger-la-privacidad' },
      { label: '¿Por qué cifrar la información sensible?', org: 'INCIBE', url: 'https://www.incibe.es/empresas/blog/cifrar-informacion-sensible' },
      { label: 'Zero-knowledge encryption explained', org: 'Proton', url: 'https://proton.me/blog/zero-knowledge-cloud-storage' },
      { label: 'Zero-access encryption (cómo protegen tus datos)', org: 'Proton', url: 'https://proton.me/security/zero-access-encryption' },
    ],
    related: ['contrasena-no-se-guarda', 'kit-de-emergencia', 'si-olvidas-la-contrasena'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'contrasena-no-se-guarda',
    category: 'seguridad',
    title:    'Tu contraseña no se guarda: lo bueno y lo que tienes que cuidar',
    readTime: '4 min',
    summary:  'Por qué es imposible que nosotros veamos tu contraseña — y qué responsabilidad te toca a ti por diseño.',
    sections: [
      {
        paragraphs: [
          'La mayoría de apps guardan tu contraseña en su servidor (generalmente "hasheada", pero guardada). Nosotros no. Esto es una característica fundamental del modelo Zero-Knowledge: tu contraseña nunca toca nuestros servidores, ni siquiera por milisegundos.',
        ],
      },
      {
        heading: 'Lo que hacemos en tu navegador',
        paragraphs: [
          'Cuando te registras o inicias sesión, tu contraseña se queda en tu navegador y pasa por un proceso que la convierte en una llave criptográfica. Ese proceso se llama derivación de llave y usa un algoritmo llamado PBKDF2.',
        ],
        example: {
          title: 'Proceso de derivación',
          lines: [
            'Tu contraseña:  "miContraseña123!"',
            '  +',
            'Salt único (generado la primera vez):  "f3a2bc98..."',
            '  ↓',
            'PBKDF2 con 310,000 iteraciones         ← toma ~300ms',
            '  ↓',
            'KEK (Key Encrypting Key)               ← se usa para envolver tu DEK',
            '',
            'Lo que sale al servidor:     nada relacionado con la contraseña',
            'Lo que queda en tu equipo:   la KEK viva en RAM mientras usas la app',
          ],
        },
        callout: {
          kind: 'info',
          text: 'Las 310,000 iteraciones son intencionales: hacen que probar contraseñas por fuerza bruta sea computacionalmente inviable. Es la recomendación OWASP vigente para aplicaciones en producción.',
        },
      },
      {
        heading: '¿Qué guarda localStorage?',
        paragraphs: [
          'En tu navegador guardamos dos cosas: el "salt" (un número aleatorio público que se combina con tu contraseña) y tu "llave envuelta" (la DEK cifrada con la KEK). Ninguno de los dos es un secreto por sí solo — sin tu contraseña, no sirven para nada.',
          'Esto permite que puedas recargar la página sin hacer logout: al refrescar, te pedimos la contraseña de vuelta, reconstruimos la KEK, y desenvolvemos la DEK. No necesitamos molestarte con un login completo.',
        ],
      },
      {
        heading: 'La parte que te toca a ti',
        paragraphs: [
          'Como nosotros no podemos leer tu contraseña, tampoco podemos resetearla por email como hacen otras apps. Pero sí puedes recuperar la cuenta si olvidas la contraseña — usando tu frase de 12 palabras (el Kit de Emergencia que guardaste al registrarte).',
          'Aun así, tu contraseña es el acceso diario. Trátala como algo crítico. INCIBE (Instituto Nacional de Ciberseguridad de España) recomienda estas prácticas:',
        ],
        list: [
          'Mínimo 12 caracteres. Cuanto más larga, mejor (cada carácter extra multiplica el tiempo de fuerza bruta).',
          'Mezcla mayúsculas, minúsculas, números y símbolos.',
          'No uses información personal (nombres, fechas, mascotas). Un atacante que te conoce puede probarla primero.',
          'No reutilices contraseñas entre servicios. Si filtran una app, no comprometas a las demás.',
          'Evita palabras de diccionario solas ("caballo123" no es seguro — "caballo-morado-jueves-azul" sí).',
        ],
      },
      {
        heading: 'Recomendación fuerte: gestor de contraseñas',
        paragraphs: [
          'Un gestor de contraseñas es una app que guarda todas tus contraseñas cifradas con una sola contraseña maestra. Tú solo memorizas una, el gestor hace el resto. INCIBE lo recomienda explícitamente.',
          'Algunas opciones recomendadas por INCIBE:',
        ],
        list: [
          'KeePass / KeePassXC: open source, gratis, tus contraseñas se guardan solo en tu dispositivo (máxima privacidad).',
          'Proton Pass: también Zero-Knowledge, hecho por la misma gente de ProtonMail, tiene plan gratis.',
          'Bitwarden: open source, con versión gratuita completa y sincronización.',
        ],
        callout: {
          kind: 'tip',
          text: 'Si hasta ahora usabas la misma contraseña en varios sitios, este es el momento de cambiarlo. Bájate un gestor, anota tu contraseña maestra en papel guardado en un lugar seguro, y empieza a usar contraseñas únicas para cada servicio.',
        },
      },
      {
        heading: 'Y si la olvidas, tienes la frase',
        paragraphs: [
          'Este sistema es distinto a una app tradicional sin cifrado. Cuando te registras, el sistema te da un Kit de Emergencia con 12 palabras — una "llave alternativa" a tus datos. Si algún día olvidas la contraseña, usas esa frase en el flujo de recuperación y defines una contraseña nueva sin perder nada.',
          'Por eso insistimos tanto en guardar bien el Kit al momento del registro: es tu red de seguridad. Sin él, y sin contraseña, no hay vuelta posible.',
        ],
      },
    ],
    sources: [
      { label: 'Gestión de contraseñas seguras', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/tematicas/contrasenas-seguras' },
      { label: '¿Contraseñas seguras? Te explicamos cómo conseguirlo', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/blog/contrasenas-seguras-te-explicamos-como-conseguirlo' },
      { label: 'Gestores de contraseñas', org: 'INCIBE', url: 'https://www.incibe.es/node/499093' },
      { label: '¿Por qué es útil y seguro usar un gestor de contraseñas?', org: 'INCIBE', url: 'https://www.incibe.es/incibe/sala-de-prensa/util-y-seguro-utilizar-gestor-contrasenas' },
      { label: 'KeePassXC (gestor recomendado)', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/herramientas/keepassxc' },
      { label: 'Aprende a gestionar tus contraseñas', org: 'OSI', url: 'https://www.osi.es/es/contrasenas' },
    ],
    related: ['que-es-e2ee', 'kit-de-emergencia', 'si-olvidas-la-contrasena'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'si-olvidas-la-contrasena',
    category: 'seguridad',
    title:    '¿Qué pasa si olvidas la contraseña?',
    readTime: '4 min',
    summary:  'Tienes una red de seguridad: la frase de recuperación de 12 palabras. Aquí te explicamos cómo usarla paso a paso.',
    sections: [
      {
        paragraphs: [
          'Buenas noticias antes que nada: si guardaste tu Kit de Emergencia cuando te registraste, puedes recuperar la cuenta aunque olvides la contraseña por completo. La mala noticia es que si perdiste la contraseña Y la frase, ahí sí se acabó — pero con una sola de las dos, estás cubierto.',
          'Este artículo te explica cómo hacer la recuperación, qué pasa en cada caso, y qué hacer para no llegar a perder ambas.',
        ],
      },
      {
        heading: 'Cómo recuperar la cuenta con tu frase',
        paragraphs: [
          'El flujo son tres pasos bien directos. Toma 2-3 minutos.',
        ],
        list: [
          '1. En la pantalla de login, haz clic en "¿Olvidaste tu contraseña?".',
          '2. Ingresa tu email — el mismo con el que te registraste.',
          '3. Escribe o pega las 12 palabras de tu frase de recuperación (en el mismo orden que las recibiste).',
          '4. Define una nueva contraseña.',
          '5. Listo — quedas logueado automáticamente con la nueva contraseña.',
        ],
        callout: {
          kind: 'info',
          text: 'Tus datos NO se pierden en este proceso. La frase desbloquea la misma llave criptográfica que tu contraseña — solo estás cambiando uno de los dos caminos de acceso. Todo tu historial, deudas y presupuestos siguen intactos.',
        },
      },
      {
        heading: '¿Por qué funciona así?',
        paragraphs: [
          'Cuando creaste tu cuenta, el sistema generó una llave maestra (DEK) que cifra todos tus datos. Esa llave se "envuelve" con DOS caminos:',
        ],
        list: [
          '🔑 Camino de contraseña: deriva una clave desde tu contraseña + guarda la llave envuelta.',
          '🆘 Camino de frase: deriva otra clave desde tu frase de 12 palabras + guarda otra copia envuelta.',
        ],
      },
      {
        paragraphs: [
          'Cualquiera de los dos caminos abre la misma caja fuerte. Si pierdes uno, el otro sigue funcionando. Y al recuperar la cuenta, simplemente generamos un camino de contraseña nuevo con tu nueva contraseña.',
        ],
      },
      {
        heading: 'Si también perdiste la frase',
        paragraphs: [
          'Aquí sí no hay vuelta. Sin contraseña ni frase, los datos cifrados en el servidor son matemáticamente inútiles — ni siquiera nosotros podemos descifrarlos. Tus opciones son:',
        ],
        list: [
          'Revisa TODOS los lugares donde pudiste guardar la frase (papel en cajones, gestor de contraseñas, nota segura en el celular, PDF descargado en alguna carpeta vieja).',
          'Si usas gestor de contraseñas, busca en la categoría "Notas seguras" o "Archivos adjuntos".',
          'Si descargaste el Kit de Emergencia como PDF, revisa la carpeta "Descargas" del navegador con el que te registraste.',
          'Último recurso: regístrate con una cuenta nueva. Pierdes el historial pero empiezas limpio.',
        ],
        callout: {
          kind: 'warn',
          text: 'Este es el precio del Zero-Knowledge: si un atacante no puede leer tus datos, nosotros tampoco. La frase es el único seguro — por eso insistimos tanto en que la guardes bien.',
        },
      },
      {
        heading: 'Cómo evitar llegar a ese punto',
        paragraphs: [
          'La clave es tener ambos respaldos bien guardados, en lugares distintos:',
        ],
        list: [
          '🔒 Contraseña: usa un gestor de contraseñas (KeePassXC, Bitwarden, Proton Pass). Tu contraseña vive cifrada con una contraseña maestra que sí recuerdas.',
          '📄 Frase de recuperación: descárgala como PDF desde el Kit de Emergencia al registrarte, imprímela y guárdala en papel en un lugar físico seguro (caja fuerte, cajón con llave, documentos importantes).',
          '🤝 Contingencia: cuéntale a una persona de extrema confianza dónde está el papel — por si algo te pasa, que pueda acceder a tus finanzas.',
          '⚠️ NO guardes la frase en archivos sin cifrar, emails a ti mismo, notas sin bloqueo, ni la fotografíes en la nube.',
        ],
        callout: {
          kind: 'tip',
          text: 'La regla clave: contraseña y frase deben vivir en LUGARES FÍSICOS/DIGITALES SEPARADOS. Si guardas ambas juntas y se pierden juntas, no hay red de seguridad. Separadas, uno respalda al otro.',
        },
      },
      {
        heading: 'Si olvidas solo la contraseña — recordatorios',
        list: [
          'Revisa variaciones obvias antes de entrar al flujo de recuperación (mayúsculas, números al final, patrones comunes).',
          'Mira si tu gestor/navegador la tiene autocompletada — a veces está ahí y nunca la necesitaste escribir.',
          'Si no aparece, usa el flujo de recuperación con la frase. No hay costo ni penalización por hacerlo.',
        ],
      },
    ],
    sources: [
      { label: 'Gestores de contraseñas', org: 'INCIBE', url: 'https://www.incibe.es/node/499093' },
      { label: '¿Por qué es útil y seguro usar un gestor de contraseñas?', org: 'INCIBE', url: 'https://www.incibe.es/incibe/sala-de-prensa/util-y-seguro-utilizar-gestor-contrasenas' },
      { label: 'KeePass (gestor open source recomendado)', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/herramientas/keepass' },
      { label: 'Aprende a gestionar tus contraseñas', org: 'OSI', url: 'https://www.osi.es/es/contrasenas' },
      { label: 'Zero-knowledge: cómo funciona la arquitectura de tu app', org: 'Proton', url: 'https://proton.me/blog/zero-knowledge-cloud-storage' },
    ],
    related: ['kit-de-emergencia', 'que-es-e2ee', 'contrasena-no-se-guarda'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'kit-de-emergencia',
    category: 'seguridad',
    title:    'El Kit de Emergencia: tu red de seguridad en 12 palabras',
    readTime: '5 min',
    summary:  'Qué son esas 12 palabras que aparecen al registrarte, por qué son críticas y cómo guardarlas para que funcionen el día que las necesites.',
    sections: [
      {
        paragraphs: [
          'Al registrarte, el sistema te muestra un "Kit de Emergencia" con 12 palabras. Ese kit es tu red de seguridad: con él puedes recuperar el acceso a tu cuenta aunque olvides la contraseña por completo. Sin él, no hay vuelta.',
          'Este artículo te explica qué son esas 12 palabras, por qué son específicamente 12 (y no 10 o 16), cómo guardarlas bien, y qué hacer si las pierdes.',
        ],
      },
      {
        heading: '¿Qué son exactamente las 12 palabras?',
        paragraphs: [
          'Son una "frase de recuperación" generada aleatoriamente por tu navegador al registrarte. Siguen un estándar internacional llamado BIP39, que nació con Bitcoin y hoy usan apps como Proton Pass, Signal y wallets de crypto en general.',
          'Cada palabra viene de un diccionario español específico de 2,048 palabras, diseñado por expertos en criptografía para evitar ambigüedades: las primeras 4 letras de cada palabra son únicas (puedes autocompletar), no hay palabras similares que se confundan, y el checksum de la última palabra asegura que el orden es correcto.',
        ],
        callout: {
          kind: 'info',
          text: 'Tus 12 palabras contienen 128 bits de entropía criptográfica — el equivalente a una contraseña aleatoria de 24 caracteres mezclando letras, números y símbolos. Pero mucho más fácil de escribir en papel.',
        },
      },
      {
        heading: '¿Por qué no una contraseña "fuerte" y listo?',
        paragraphs: [
          'Porque las contraseñas fuertes que los humanos inventan NO son realmente aleatorias. Tendemos a elegir patrones: nombres, fechas, palabras comunes con sustituciones obvias ($ por s, 0 por o). Los atacantes conocen esos patrones y tienen diccionarios especializados.',
          'Las 12 palabras BIP39 son generadas por un generador criptográfico de números aleatorios en tu navegador. No hay patrón ni sesgo humano. Son matemáticamente impredecibles.',
        ],
      },
      {
        heading: 'Cómo guardar el Kit — la parte crítica',
        paragraphs: [
          'Aquí es donde la mayoría de la gente se equivoca. El Kit es tan seguro como el lugar donde lo guardes. Te pongo las opciones en orden de mejor a peor:',
        ],
        example: {
          title: 'Opciones para guardar tu Kit',
          lines: [
            '✅ MEJOR',
            '   • Imprimir el PDF y guardarlo en una caja fuerte.',
            '   • Anotar en papel y guardar en cajón con llave junto a documentos.',
            '   • Gestor de contraseñas con cifrado (KeePassXC, Bitwarden, Proton Pass).',
            '',
            '✅ ACEPTABLE',
            '   • PDF cifrado con contraseña en tu disco.',
            '   • Nota segura del celular protegida con biometría.',
            '',
            '❌ NUNCA',
            '   • Email a ti mismo (si hackean el email, hackean todo).',
            '   • Google Drive / Dropbox / iCloud sin cifrar.',
            '   • Foto del papel en tu galería del celular (se sincroniza a la nube).',
            '   • Archivo .txt sin cifrar.',
            '   • Captura de pantalla del Kit guardada en el celular.',
          ],
        },
      },
      {
        heading: 'La regla de oro — separación física',
        paragraphs: [
          'Tu contraseña y tu frase deben vivir en LUGARES DISTINTOS. Si están juntas y se pierden juntas, no hay red de seguridad. Un esquema recomendado:',
        ],
        list: [
          'Contraseña en el gestor de contraseñas (digital, sincronizado).',
          'Frase en papel físico en casa (caja fuerte, cajón con llave).',
          'Opcional: segunda copia de la frase en casa de un familiar de confianza o en una caja de seguridad bancaria.',
        ],
        callout: {
          kind: 'tip',
          text: 'Si imprimes el PDF, evita imprimirlo en una impresora compartida (oficina, librería). Hazlo en casa o en una impresora privada donde sabes que no queda cache.',
        },
      },
      {
        heading: '¿Puedo volver a ver las palabras después del registro?',
        paragraphs: [
          'No. Este es un principio del modelo Zero-Knowledge: las 12 palabras se te muestran UNA VEZ al crear la cuenta y nunca más. Ni siquiera nosotros las tenemos guardadas — no podríamos mostrártelas aunque quisiéramos.',
          'Por eso el paso de confirmación durante el registro: te pedimos ingresar 3 palabras específicas (la #4, la #7, etc.) para asegurarnos de que las tienes bien guardadas antes de finalizar. Si ese paso falla, vuelve y cópialas de nuevo con calma.',
        ],
        callout: {
          kind: 'warn',
          text: 'Si te registras y saltas rápido por este paso sin guardar la frase, la app funcionará normal por meses. Pero el día que pierdas la contraseña, estarás sin red de seguridad. Tómate los 2 minutos que requiere hacerlo bien.',
        },
      },
      {
        heading: '¿Qué hago si alguien más ve mis 12 palabras?',
        paragraphs: [
          'Son la llave maestra de tu cuenta. Si otra persona las ve, puede entrar en cualquier momento y cambiar tu contraseña sin tu consentimiento. Plan de acción:',
        ],
        list: [
          'Entra a tu cuenta con tu contraseña actual (si todavía la tienes).',
          'Idealmente contáctanos para rotar el material criptográfico — feature futura.',
          'Mientras tanto: mueve todos tus datos sensibles fuera de la app y crea una cuenta nueva con una frase nueva.',
          'Cierra la cuenta original (los datos ya expuestos no se pueden "desexponer" — limita el daño futuro).',
        ],
      },
      {
        heading: 'Comparación con otras apps E2EE',
        paragraphs: [
          'Lo que tu app hace NO es una invención nuestra — es el estándar de la industria para apps serias:',
        ],
        list: [
          'Proton Pass: 12 palabras + "Emergency Kit" PDF.',
          'Signal: PIN + recovery key.',
          '1Password: "Secret Key" aleatoria + Emergency Kit PDF.',
          'Bitcoin/Ethereum wallets: 12 o 24 palabras BIP39 (mismo estándar que nosotros).',
        ],
        callout: {
          kind: 'info',
          text: 'Si ya usas Proton Pass, Signal o una wallet de crypto, el concepto te va a resultar familiar. Si es tu primera vez, dedica 5 minutos a guardarlas bien — es la diferencia entre tener una red de seguridad y no tenerla.',
        },
      },
    ],
    sources: [
      { label: 'Zero-access encryption (cómo Proton maneja la recuperación)', org: 'Proton', url: 'https://proton.me/security/zero-access-encryption' },
      { label: 'Zero-knowledge cloud storage', org: 'Proton', url: 'https://proton.me/blog/zero-knowledge-cloud-storage' },
      { label: 'Cifrado de la información', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/tematicas/cifrado' },
      { label: 'Gestores de contraseñas', org: 'INCIBE', url: 'https://www.incibe.es/node/499093' },
      { label: 'KeePassXC (gestor open source)', org: 'INCIBE', url: 'https://www.incibe.es/ciudadania/herramientas/keepassxc' },
      { label: 'Aprende a gestionar tus contraseñas', org: 'OSI', url: 'https://www.osi.es/es/contrasenas' },
    ],
    related: ['si-olvidas-la-contrasena', 'que-es-e2ee', 'contrasena-no-se-guarda'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECCIÓN: SISTEMA — Tutoriales paso a paso
  // Estos cinco artículos se agregaron para alimentar el ícono ❓ de ayuda
  // contextual de cada vista (Dashboard, Presupuesto, Deudas, etc.). El copy
  // base proviene de "FinanzasApp/06 - Guía de Usuario.md" en Obsidian,
  // adaptado al schema sections/sources del resto de la guía.
  // ═══════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'que-es-finanzasapp',
    category: 'sistema',
    title:    '¿Qué es FinanzasApp?',
    readTime: '2 min',
    summary:  'Una vista general del sistema y de sus cuatro módulos: Dashboard, Presupuesto, Deudas y Ahorros.',
    sections: [
      {
        paragraphs: [
          'FinanzasApp es tu espacio personal para entender a dónde va tu dinero cada mes y tomar el control de tus deudas. No necesitas ser contador ni experto en finanzas — la app hace los cálculos por ti.',
        ],
      },
      {
        heading: 'Las cuatro secciones principales',
        paragraphs: [
          'El menú lateral te da acceso a las áreas que cubren todo tu ciclo financiero mes a mes:',
        ],
        list: [
          '📊 Dashboard — un resumen visual de tu situación financiera actual.',
          '📋 Presupuesto — planifica tus ingresos, facturas y gastos mes a mes.',
          '💳 Deudas — registra y da seguimiento a todas tus deudas con proyecciones exactas.',
          '🐷 Ahorros — establece y monitorea tus metas de ahorro.',
        ],
      },
      {
        heading: 'Tus datos están protegidos',
        paragraphs: [
          'Todo lo que registras en tu presupuesto se cifra directamente en tu dispositivo antes de enviarse al servidor. Ni siquiera nosotros podemos leer tus datos. Esto se llama cifrado de extremo a extremo (E2EE) — la misma tecnología que usan apps como Signal o ProtonMail.',
        ],
        callout: {
          kind: 'tip',
          text: 'Si quieres profundizar en cómo funciona el cifrado, en la sección de Seguridad de esta misma guía hay un artículo dedicado al tema y otro sobre cómo manejar tu Kit de Emergencia.',
        },
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
      { label: 'Programa de Educación Financiera — Banxico', org: 'Banxico', url: 'https://www.banxico.org.mx' },
    ],
    related: ['primer-presupuesto', 'registrar-deudas', 'que-es-e2ee'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'primer-presupuesto',
    category: 'sistema',
    title:    'Tu primer presupuesto paso a paso',
    readTime: '6 min',
    summary:  'Crea tu primer presupuesto mensual: ingresos, facturas, categorías de gasto variable y transacciones diarias.',
    sections: [
      {
        paragraphs: [
          'Un presupuesto es un plan de cómo usarás tu dinero en un mes específico. Aquí te explicamos cómo crear uno desde cero, paso a paso.',
        ],
      },
      {
        heading: 'Paso 1 — Ir a Presupuesto',
        paragraphs: [
          'En el menú lateral, toca 📋 Presupuesto. Verás la pantalla "Presupuestos" con el historial mensual organizado por año.',
        ],
      },
      {
        heading: 'Paso 2 — Crear un presupuesto nuevo',
        paragraphs: [
          'Toca el botón "+ Nuevo presupuesto" en la esquina superior derecha. Selecciona el Año y el Mes para el que quieres planificar y toca "Crear presupuesto".',
        ],
        callout: {
          kind: 'info',
          text: 'Si el mes ya tiene un presupuesto, verás el badge "Activo" en la cuadrícula. El mes en curso muestra el badge "Actual".',
        },
      },
      {
        heading: 'Paso 3 — Agregar tus ingresos',
        paragraphs: [
          'Dentro del presupuesto, ve a la pestaña Ingresos. Toca "+ Agregar ingreso" y completa:',
        ],
        list: [
          'Nombre (requerido) — cómo identificas este ingreso. Ejemplos: "Sueldo", "Freelance".',
          'Presupuestado (requerido) — lo que esperas recibir este mes.',
          'Real (ingresado) — lo que realmente recibiste. Puedes dejarlo en 0 y actualizarlo después.',
        ],
        callout: { kind: 'tip', text: 'Repite este paso por cada fuente de ingreso que tengas.' },
      },
      {
        heading: 'Paso 4 — Agregar tus facturas',
        paragraphs: [
          'Las facturas son los gastos fijos que pagas cada mes: renta, internet, teléfono, suscripciones, seguros. NO registres aquí tus tarjetas de crédito — esas van en el módulo Deudas.',
          'Ve a la pestaña Facturas y toca "+ Agregar factura". Completa:',
        ],
        list: [
          'Nombre (requerido) — ej. "Renta", "Netflix", "CFE".',
          'Presupuestado (requerido) — cuánto cuesta normalmente.',
          'Real pagado — lo que pagaste de verdad. Actualízalo cuando lo pagues.',
          'Fecha de vencimiento — el día del mes que vence.',
          'Método de pago — Efectivo, Tarjeta de crédito, Tarjeta de débito, Transferencia u Otro.',
        ],
      },
      {
        heading: 'Paso 5 — Definir gastos variables',
        paragraphs: [
          'En la pestaña Gastos variables defines categorías con un límite de gasto mensual. Por ejemplo: "Comida $3,000" o "Transporte $800".',
          'Toca "+ Agregar categoría". En el modal:',
        ],
        list: [
          'Categoría (requerida) — elige una existente o toca "+ Nueva categoría" para crear la tuya.',
          'Presupuesto para esta categoría (requerido) — el límite que te propones no superar.',
        ],
        callout: {
          kind: 'info',
          text: 'Al crear una nueva categoría, asígnale una clasificación según la regla 50/30/20: Necesidad (lo esencial) o Deseo (lo que puedes recortar). Eso alimenta el resumen 50/30/20 de tu presupuesto.',
        },
      },
      {
        heading: 'Paso 6 — Registrar transacciones',
        paragraphs: [
          'Ve a la pestaña Transacciones. Aquí llevas tu libreta de movimientos diarios: cada vez que hagas un gasto, toca "+ Registrar gasto" para mantener el seguimiento real.',
        ],
        list: [
          'Monto (requerido)',
          'Fecha (requerida)',
          'Categoría (requerida)',
          'Método de pago',
          'Nota — ej. "Uber", "Walmart", "restaurante con amigos".',
        ],
      },
      {
        heading: '¿Cómo saber si mi presupuesto está bien?',
        paragraphs: [
          'En la cabecera del presupuesto verás el chip "Disponible: $X" en verde, o "Déficit: $X" en rojo. Si es positivo, tus ingresos superan tus gastos y estás dentro de tu plan.',
        ],
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
      { label: 'Programa de Educación Financiera — Banxico', org: 'Banxico', url: 'https://www.banxico.org.mx' },
    ],
    related: ['regla-50-30-20'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'registrar-deudas',
    category: 'sistema',
    title:    'Cómo registrar tus deudas',
    readTime: '5 min',
    summary:  'Da de alta una deuda con todos sus datos: capital, tasa (fija o variable), plazo, IVA sobre intereses y estrategia preferida.',
    sections: [
      {
        paragraphs: [
          'En el menú lateral, toca 💳 Deudas. Esta sección es el corazón de la app para quienes tienen tarjetas de crédito, créditos personales o cualquier compromiso con un banco o financiera.',
        ],
      },
      {
        heading: '¿Qué es una deuda en la app?',
        paragraphs: [
          'Cualquier dinero que le debes a un banco o financiera: tarjeta de crédito, crédito personal, un plazo fijo. NO registres aquí las compras a meses sin intereses (MSI) — esas tienen su propio módulo.',
        ],
      },
      {
        heading: 'Cómo agregar una deuda',
        paragraphs: [
          'Toca "+ Nueva deuda" en la esquina superior derecha. Se abre el modal con los siguientes campos.',
        ],
      },
      {
        heading: 'Datos obligatorios',
        list: [
          'Nombre de la deuda — cómo la identificas. Ej. "Tarjeta clásica - 5523", "Crédito personal diciembre".',
          'Capital inicial — el monto original del crédito cuando lo contrataste. Búscalo en tu estado de cuenta bajo "Límite de crédito" o "Monto del crédito".',
          'Saldo restante actual — lo que debes hoy. Tu estado de cuenta lo muestra como "Saldo total".',
          'Pago mínimo mensual — lo mínimo que el banco te pide cada mes.',
          'Tasa de interés anual (%) — el porcentaje que cobra el banco por año. Está en tu estado de cuenta, usualmente marcado como "Tasa Anual" o "CAT".',
          'Fecha de inicio — cuándo contrataste el crédito o la fecha de tu primer estado de cuenta.',
        ],
      },
      {
        heading: 'Tipo de tasa: fija o variable',
        paragraphs: ['Junto a la tasa anual verás un selector con dos opciones:'],
        list: [
          'Fija — la tasa no cambia. Las proyecciones son confiables a largo plazo.',
          'Variable — la tasa puede subir o bajar según un índice (como la TIIE en México). Si seleccionas Variable, la app te avisará en el detalle de la deuda que las proyecciones usan la tasa actual y pueden cambiar.',
        ],
        callout: {
          kind: 'tip',
          text: 'Si tu deuda es de tasa variable, recuerda actualizar la tasa en la app cada vez que el banco te avise de un cambio. La app guarda la fecha de la última edición para que sepas qué tan vigente es la proyección.',
        },
      },
      {
        heading: 'Datos opcionales',
        list: [
          'Plazo (meses) — solo para créditos a plazo fijo (ej. 24 meses). Déjalo vacío para tarjetas revolventes.',
          'IVA sobre intereses (%) — en México, las tarjetas de crédito generan un IVA del 16% sobre los intereses. Agrégalo para que los cálculos sean precisos.',
          'Orden de prioridad — un número para ordenar cuál deuda atacas primero.',
          'Estrategia preferida — ❄️ Bola de nieve, 🌊 Avalancha o 🔥 Fireball.',
          'Estado — Activa o Pausada.',
          'Notas — cualquier información adicional.',
        ],
      },
      {
        heading: 'Editar o eliminar una deuda',
        paragraphs: ['En la tarjeta de cada deuda verás dos botones:'],
        list: [
          '✏ Editar deuda — abre el mismo formulario pre-llenado con los datos actuales.',
          '🗑 Eliminar deuda — pide confirmación antes de borrar.',
        ],
        callout: {
          kind: 'warn',
          text: 'Importante: al eliminar una deuda se borran también todos los pagos registrados de esa deuda. La acción no se puede deshacer.',
        },
      },
      {
        heading: 'Ver el detalle de una deuda',
        paragraphs: [
          'Toca "Ver detalle →" en cualquier tarjeta. Ahí encontrarás la tabla de amortización completa, el historial de pagos y el "Estimado para liquidar hoy".',
        ],
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
      { label: 'CAT, GAT y tasas — Banxico', org: 'Banxico', url: 'https://www.banxico.org.mx' },
    ],
    related: ['capital-vs-interes', 'tasa-anual-vs-mensual', 'estrategias-pago-deudas'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'registrar-pago',
    category: 'sistema',
    title:    'Cómo registrar un pago a una deuda',
    readTime: '3 min',
    summary:  'Cuatro pasos para que el saldo y las proyecciones queden actualizados después de cada abono.',
    sections: [
      {
        paragraphs: [
          'Cada vez que abones a una deuda, regístralo en la app para que el saldo se actualice y las proyecciones de amortización sean precisas.',
        ],
      },
      {
        heading: 'Paso a paso',
        list: [
          '1. Entra al detalle de la deuda tocando "Ver detalle →" en su tarjeta.',
          '2. Toca el botón "💳 Registrar pago" en la cabecera.',
          '3. En el modal completa: monto pagado (requerido — el modal te muestra el pago mínimo sugerido como referencia), fecha del pago (requerida) y nota opcional. Ejemplo de nota: "Abono extra de quincena".',
          '4. Toca "Registrar".',
        ],
      },
      {
        heading: 'Dónde queda el registro',
        paragraphs: [
          'El historial de pagos queda en la pestaña "Historial de pagos" dentro del detalle. Puedes editar un pago con el ✏️ o eliminarlo con el 🗑️.',
        ],
        callout: {
          kind: 'tip',
          text: 'Registra tus pagos el mismo día que los haces. Si pagas más del mínimo, el saldo baja más rápido y las proyecciones de la tabla de amortización se actualizan automáticamente.',
        },
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
      { label: 'Programa de Educación Financiera — Banxico', org: 'Banxico', url: 'https://www.banxico.org.mx' },
    ],
    related: ['desglose-pago', 'capital-vs-interes'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'metas-de-ahorro',
    category: 'sistema',
    title:    'Cómo usar tus metas de ahorro',
    readTime: '5 min',
    summary:  'Define un objetivo, elige cada cuánto aportas y la app calcula cuántos meses te faltan para llegar.',
    sections: [
      {
        paragraphs: [
          'La sección "🐷 Ahorros" te ayuda a definir objetivos financieros concretos y ver cuánto tiempo necesitas para alcanzarlos según lo que puedes ahorrar cada semana, quincena o mes.',
        ],
      },
      {
        heading: '¿Qué es una meta de ahorro?',
        paragraphs: [
          'Es un objetivo financiero con nombre, monto y un plan de aporte. Por ejemplo: ahorrar $30,000 para un fondo de emergencia en 12 meses aportando $2,500 al mes. La app calcula automáticamente cuándo llegas y cuánto te falta.',
        ],
      },
      {
        heading: 'Cómo crear una meta',
        paragraphs: [
          'Toca "+ Nueva meta" en la esquina superior derecha. Se abre el formulario con los siguientes campos:',
        ],
        list: [
          'Nombre de la meta (requerido) — sé específico: "Fondo de emergencia", "Vacaciones Oaxaca", "MacBook", "Enganche depa".',
          'Monto objetivo (requerido) — cuánto dinero quieres acumular en total. Es tu meta final.',
          'Fecha límite (opcional) — fecha concreta para la que necesitas el dinero. La app la muestra como referencia y no bloquea nada si no la cumples.',
          'Frecuencia de contribución — cada cuánto aportas: Mensual, Quincenal, Semanal o Único.',
          'Monto recurrente — cuánto aportas cada vez que contribuyes (según la frecuencia que elegiste).',
          'Notas (opcional) — cualquier detalle que quieras recordar sobre esta meta.',
        ],
      },
      {
        heading: 'Cómo afecta la frecuencia a la proyección',
        paragraphs: [
          'La app convierte tu monto recurrente al equivalente mensual antes de calcular los meses restantes. Lo que ingresas se multiplica por la cantidad de períodos que caben en un mes según la cadencia que elegiste.',
        ],
        example: {
          title: 'Aporte mensual efectivo según frecuencia',
          lines: [
            'Mensual    × 1       — $1,000 → $1,000/mes efectivos',
            'Quincenal  × 2       — $500   → $1,000/mes efectivos',
            'Semanal    × 13/3    — $250   → $1,083/mes efectivos',
            'Único      sin recurrencia — sin proyección automática',
          ],
        },
        callout: {
          kind: 'tip',
          text: 'El multiplicador de "Semanal" usa 13/3 ≈ 4.333 (que sale de 52 semanas / 12 meses) — más preciso que 4.33.',
        },
      },
      {
        heading: 'Cómo leer la tarjeta de una meta',
        list: [
          'Círculo de progreso — el porcentaje acumulado sobre el total.',
          'Acumulado — el dinero que ya registraste en esta meta.',
          'Meta — el monto objetivo que definiste.',
          'Restante — cuánto te falta para llegar.',
          'Proyección (⏱️) — los meses estimados, el aporte mensual efectivo y la fecha aproximada de llegada.',
          'Frecuencia — badge con la cadencia (Mensual, Quincenal, Semanal o Único).',
        ],
      },
      {
        heading: 'Cómo contribuir a una meta',
        paragraphs: [
          'Cada vez que apartes dinero para una meta, regístralo en la app para que el progreso se actualice. Toca el botón "+ Contribuir" en la tarjeta de la meta, ingresa el monto que aportaste y confirma.',
        ],
        callout: {
          kind: 'tip',
          text: 'Registra cada aporte aunque sea parcial. El progreso visual y la proyección se recalculan con cada contribución.',
        },
      },
      {
        heading: '¿Qué pasa con la proyección?',
        paragraphs: [
          'La proyección calcula tres cosas: el aporte mensual efectivo (lo que aportas al mes considerando tu frecuencia), los meses estimados (Restante ÷ Aporte mensual efectivo, redondeado hacia arriba) y la fecha de llegada (hoy más los meses estimados).',
          'Si elegiste Único, la proyección dice: "Meta de aporte único — registra un abono cuando tengas el monto disponible". En ese caso contribuyes cuando estés listo, no hay cálculo automático.',
        ],
      },
      {
        heading: 'Editar, eliminar y estados',
        list: [
          '✏ Editar — abre el formulario pre-llenado para cambiar nombre, monto, frecuencia o notas.',
          '🗑 Eliminar — borra la meta y todo su historial de contribuciones. Pide confirmación antes de borrar.',
          'En curso — tienes saldo acumulado menor al objetivo.',
          'Completada 🎉 — llegaste al 100% del monto objetivo.',
        ],
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
    ],
    related: ['regla-50-30-20', 'primer-presupuesto'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug:     'glosario',
    category: 'conceptos',
    title:    'Glosario de términos financieros',
    readTime: '4 min',
    summary:  'Definiciones rápidas de los términos que verás en la app y en tus estados de cuenta.',
    sections: [
      {
        paragraphs: [
          'Listado en orden alfabético de los términos clave que usa la app y que también vas a encontrar en cualquier estado de cuenta. Si te aparece una palabra que no conoces, búscala primero acá.',
        ],
      },
      {
        heading: 'A — D',
        list: [
          'Amortización — el proceso de reducir gradualmente una deuda mediante pagos periódicos que cubren capital e intereses.',
          'Avalancha (🌊) — estrategia de pago que prioriza la deuda con la tasa de interés más alta. Minimiza el total de intereses pagados.',
          'Bola de nieve (❄️) — estrategia de pago que prioriza la deuda con el saldo más pequeño. Genera motivación con victorias tempranas.',
          'Capital — el monto principal de una deuda, sin contar intereses. Cuando pagas capital, tu saldo real baja.',
          'Capital amortizado — cuánto capital has reducido con tus pagos hasta la fecha.',
          'Capital inicial — el monto original del crédito cuando lo contrataste.',
          'Déficit — cuando tus gastos superan tus ingresos en el mes. La app lo muestra en rojo en la cabecera del presupuesto.',
          'Disponible — lo que te queda de tu ingreso después de descontar gastos y facturas. La app lo muestra en verde.',
        ],
      },
      {
        heading: 'F — I',
        list: [
          'Fireball (🔥) — combinación de Bola de nieve y Avalancha. Elimina primero las deudas pequeñas y luego ataca las de mayor costo.',
          'Interés — el costo de pedir dinero prestado. El banco cobra un porcentaje mensual sobre tu saldo pendiente.',
          'Interés devengado — el interés que ya acumuló tu deuda desde el último corte, antes de que llegue tu próximo estado de cuenta.',
          'Interés moratorio — cargo adicional que aplica el banco cuando no pagas antes de la fecha límite.',
          'IVA sobre intereses — en México, los intereses de tarjetas de crédito están sujetos al 16% de IVA. Es un cargo adicional al interés mismo.',
        ],
      },
      {
        heading: 'P — T',
        list: [
          'Pago mínimo — el monto mínimo que el banco acepta cada mes para considerar tu cuenta al corriente. Pagar solo el mínimo es la forma más lenta y cara de saldar una deuda.',
          'Plazo — número de meses acordados para pagar un crédito. Aplica a créditos a plazo fijo, no a tarjetas revolventes.',
          'Presupuesto — plan de cómo distribuirás tu dinero en un mes. Divide tu ingreso entre gastos fijos (Facturas), gastos variables y pago de deudas.',
          'Regla 50/30/20 — método para dividir el ingreso mensual: 50% necesidades, 30% deseos, 20% ahorro o inversión.',
          'Saldo restante — lo que debes en este momento. Disminuye con cada pago de capital.',
          'Tasa de interés anual — el porcentaje que el banco cobra por año sobre tu deuda. Se divide entre 12 para calcular el interés mensual.',
          'Tasa fija — tasa que no cambia durante la vida del crédito. Las proyecciones son confiables.',
          'Tasa variable — tasa que puede cambiar según un índice de referencia (en México, la TIIE). Cuando cambia, actualiza el dato en la app.',
          'TIIE (Tasa de Interés Interbancaria de Equilibrio) — la tasa de referencia del Banco de México. Muchas tarjetas y créditos variables se expresan como "TIIE + X%".',
        ],
      },
    ],
    sources: [
      { label: 'Educación Financiera — CONDUSEF', org: 'CONDUSEF', url: 'https://www.condusef.gob.mx' },
      { label: 'CAT, GAT y tasas — Banxico', org: 'Banxico', url: 'https://www.banxico.org.mx' },
    ],
    related: ['capital-vs-interes', 'tasa-anual-vs-mensual'],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

export function findArticle(slug: string): GuideArticle | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

export function articlesByCategory(cat: GuideCategory): GuideArticle[] {
  return ARTICLES.filter(a => a.category === cat)
}

/** Devuelve el artículo anterior y siguiente según el orden del array */
export function neighbors(slug: string): { prev?: GuideArticle; next?: GuideArticle } {
  const i = ARTICLES.findIndex(a => a.slug === slug)
  if (i === -1) return {}
  return {
    prev: i > 0 ? ARTICLES[i - 1] : undefined,
    next: i < ARTICLES.length - 1 ? ARTICLES[i + 1] : undefined,
  }
}
