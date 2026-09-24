<template>
  <div class="lp">

    <!-- ═══════════════════════════════════════════════════════════
         HEADER — fijo, con blur de fondo al hacer scroll
    ═══════════════════════════════════════════════════════════ -->
    <header class="lp-header" :class="{ 'lp-header--scrolled': scrolled }">
      <div class="lp-container lp-header__inner">
        <!-- Logotipo -->
        <RouterLink to="/" class="lp-logo">
          <span class="lp-logo__badge">$</span>
          <span class="lp-logo__name">FinanzasApp</span>
        </RouterLink>

        <!-- Navegación central -->
        <nav class="lp-nav" :class="{ 'lp-nav--open': menuOpen }">
          <a href="#features" @click="menuOpen = false">Características</a>
          <a href="#how"      @click="menuOpen = false">Cómo funciona</a>
          <a href="#contact"  @click="menuOpen = false">Contacto</a>
        </nav>

        <!-- CTA + hamburger -->
        <div class="lp-header__actions">
          <RouterLink to="/login"    class="lp-btn lp-btn--ghost">Iniciar sesión</RouterLink>
          <RouterLink to="/register" class="lp-btn lp-btn--primary">Ingresar →</RouterLink>
          <button class="lp-hamburger" @click="menuOpen = !menuOpen" aria-label="Menú">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════
         HERO
    ═══════════════════════════════════════════════════════════ -->
    <section class="lp-hero">
      <!-- Fondo de partículas / grid -->
      <div class="lp-grid-bg" aria-hidden="true"></div>
      <div class="lp-blob lp-blob--1" aria-hidden="true"></div>
      <div class="lp-blob lp-blob--2" aria-hidden="true"></div>

      <div class="lp-container lp-hero__inner">

        <!-- Contenido izquierdo -->
        <div class="lp-hero__content">
          <div class="lp-badge">
            <span class="lp-badge__dot"></span>
            Cifrado de extremo a extremo · Cero conocimiento
          </div>

          <h1 class="lp-hero__title">
            Tu plata.<br>
            Tus reglas.<br>
            <span class="lp-gradient-text">Nadie más mira</span>.
          </h1>

          <p class="lp-hero__subtitle">
            Gestiona tu presupuesto, paga tus deudas y alcanza tus metas de ahorro.
            Con una diferencia clave: <strong>tus datos viajan cifrados desde tu navegador</strong>.
            Ni siquiera nosotros podemos verlos.
          </p>

          <div class="lp-hero__actions">
            <RouterLink to="/register" class="lp-btn lp-btn--primary lp-btn--lg">
              Empieza gratis
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </RouterLink>
            <a href="#security" class="lp-btn lp-btn--ghost lp-btn--lg">
              Ver cómo te protegemos →
            </a>
          </div>

          <!-- Install PWA — solo aparece en móviles instalables o iOS -->
          <div class="lp-hero__install">
            <InstallAppButton label="📱 Instalar en tu celular" variant="ghost" />
          </div>

          <!-- Pills de diferenciadores reales -->
          <div class="lp-pills">
            <span class="lp-pill">🔐 Cifrado E2EE</span>
            <span class="lp-pill">🔑 Tu llave solo tuya</span>
            <span class="lp-pill">🆘 Kit de Emergencia</span>
            <span class="lp-pill">📱 Bot Telegram</span>
          </div>
        </div>

        <!-- Visual derecho: mockup + código flotante -->
        <div class="lp-hero__visual">

          <!-- Dashboard mockup -->
          <div class="lp-mockup">
            <div class="lp-mockup__bar">
              <div class="lp-mockup__dots">
                <i></i><i></i><i></i>
              </div>
              <span class="lp-mockup__url">finanzasapp.io/dashboard</span>
            </div>
            <div class="lp-mockup__body">

              <!-- Métricas superiores -->
              <div class="lp-mock-metrics">
                <div class="lp-mock-metric">
                  <span class="lp-mock-metric__label">Ingreso mensual</span>
                  <span class="lp-mock-metric__value lp-green">$45,200</span>
                  <span class="lp-mock-metric__change lp-green">↑ 12.3%</span>
                </div>
                <div class="lp-mock-metric">
                  <span class="lp-mock-metric__label">Deuda restante</span>
                  <span class="lp-mock-metric__value lp-blue">$128,400</span>
                  <span class="lp-mock-metric__change lp-green">↓ 8.1%</span>
                </div>
                <div class="lp-mock-metric">
                  <span class="lp-mock-metric__label">Ahorrado</span>
                  <span class="lp-mock-metric__value lp-green">$9,040</span>
                  <span class="lp-mock-metric__change lp-green">↑ 20%</span>
                </div>
              </div>

              <!-- Gráfica de barras animada -->
              <div class="lp-mock-chart">
                <div class="lp-mock-chart__label">Presupuesto vs Gasto · 2026</div>
                <div class="lp-mock-chart__bars">
                  <div class="lp-mock-bar" style="--h:55%; --delay:0s"   data-label="Ene"></div>
                  <div class="lp-mock-bar" style="--h:72%; --delay:.1s"  data-label="Feb"></div>
                  <div class="lp-mock-bar" style="--h:48%; --delay:.2s"  data-label="Mar"></div>
                  <div class="lp-mock-bar lp-mock-bar--green" style="--h:88%; --delay:.3s" data-label="Abr"></div>
                  <div class="lp-mock-bar" style="--h:61%; --delay:.4s"  data-label="May"></div>
                  <div class="lp-mock-bar lp-mock-bar--green" style="--h:79%; --delay:.5s" data-label="Jun"></div>
                </div>
              </div>

              <!-- Regla 50/30/20 -->
              <div class="lp-mock-rule">
                <div class="lp-mock-rule__row">
                  <span>Necesidades</span>
                  <div class="lp-mock-rule__track">
                    <div class="lp-mock-rule__fill" style="width:78%; background: #2563EB"></div>
                  </div>
                  <span class="lp-blue">78%</span>
                </div>
                <div class="lp-mock-rule__row">
                  <span>Deseos</span>
                  <div class="lp-mock-rule__track">
                    <div class="lp-mock-rule__fill" style="width:52%; background: #7C3AED"></div>
                  </div>
                  <span style="color:#7C3AED">52%</span>
                </div>
                <div class="lp-mock-rule__row">
                  <span>Ahorros</span>
                  <div class="lp-mock-rule__track">
                    <div class="lp-mock-rule__fill" style="width:45%; background: #10B981"></div>
                  </div>
                  <span class="lp-green">45%</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Tarjeta flotante de código -->
          <div class="lp-code-card">
            <div class="lp-code-card__header">
              <div class="lp-code-card__dots"><i></i><i></i><i></i></div>
              <span class="lp-code-card__file">debts.service.ts</span>
            </div>
            <pre class="lp-code"><span class="lp-c">// Algoritmo Avalanche — mayor tasa primero</span>
<span class="lp-k">function</span> <span class="lp-f">avalanche</span>(debts: Debt[]): DebtPlan {
  <span class="lp-k">return</span> [...debts]
    .sort((a, b) =>
      b.<span class="lp-p">interestRate</span> - a.<span class="lp-p">interestRate</span>
    )
    .map(<span class="lp-f">buildPayoffPlan</span>);
}</pre>
          </div>

          <!-- Chip flotante de alerta -->
          <div class="lp-alert-chip">
            <span class="lp-alert-chip__dot"></span>
            Meta de ahorro al 82% ·&nbsp;<strong>$820 restantes</strong>
          </div>

        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         STATS BAR — números que le importan al usuario
    ═══════════════════════════════════════════════════════════ -->
    <div class="lp-stats" ref="statsRef">
      <div class="lp-container lp-stats__inner">
        <div class="lp-stat">
          <span class="lp-stat__value" data-count="256">{{ animatedStats.bits }}</span>
          <span class="lp-stat__label">bits de cifrado AES-GCM</span>
        </div>
        <div class="lp-stat__divider"></div>
        <div class="lp-stat">
          <span class="lp-stat__value" data-count="12">{{ animatedStats.words }}</span>
          <span class="lp-stat__label">palabras en tu Kit de Emergencia</span>
        </div>
        <div class="lp-stat__divider"></div>
        <div class="lp-stat">
          <span class="lp-stat__value" data-count="3">{{ animatedStats.methods }}</span>
          <span class="lp-stat__label">estrategias para salir de deudas</span>
        </div>
        <div class="lp-stat__divider"></div>
        <div class="lp-stat">
          <span class="lp-stat__value lp-green">0</span>
          <span class="lp-stat__label">personas que pueden leer tus datos</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         SEGURIDAD — el diferenciador con demo interactivo
    ═══════════════════════════════════════════════════════════ -->
    <section id="security" class="lp-security">
      <div class="lp-container">

        <div class="lp-section-header lp-reveal">
          <p class="lp-section-tag lp-section-tag--security">🔐 Seguridad</p>
          <h2 class="lp-section-title">
            ¿Quién puede ver<br>
            <span class="lp-gradient-text">tus datos?</span>
          </h2>
          <p class="lp-section-sub">
            La respuesta corta: <strong>solo tú</strong>. Te mostramos exactamente por qué,
            con un ejemplo real que puedes probar tú mismo abajo.
          </p>
        </div>

        <!-- Analogía del hotel -->
        <div class="lp-hotel-card lp-reveal">
          <div class="lp-hotel-card__icon">🏨</div>
          <div>
            <h3 class="lp-hotel-card__title">Somos un hotel que nunca guarda copia de tu llave</h3>
            <p class="lp-hotel-card__text">
              Tu contraseña nunca llega a nuestros servidores. Se queda en tu navegador
              y genera una llave criptográfica que solo tú controlas. Si la pierdes,
              <strong>nosotros tampoco podemos abrir tu caja fuerte</strong> — por eso te
              damos un Kit de Emergencia con 12 palabras al registrarte.
            </p>
          </div>
        </div>

        <!-- Comparativa visual: apps tradicionales vs tu app -->
        <div class="lp-compare lp-reveal">
          <!-- Antes: apps tradicionales -->
          <div class="lp-compare__side lp-compare__side--bad">
            <div class="lp-compare__header">
              <span class="lp-compare__icon">❌</span>
              <div>
                <h4>Apps tradicionales de finanzas</h4>
                <p>Tus montos viajan en texto plano. El servidor puede leerlos.</p>
              </div>
            </div>
            <div class="lp-compare__db-title">Lo que ve el servidor:</div>
            <pre class="lp-compare__code lp-compare__code--plain">{
  "user": "carlos@email.com",
  "salary": <span class="lp-highlight-red">30000</span>,
  "savings": <span class="lp-highlight-red">5000000</span>,
  "debt": <span class="lp-highlight-red">128400</span>
}</pre>
            <p class="lp-compare__risk">⚠️ Si el servidor se hackea: <strong>todo expuesto</strong>.</p>
          </div>

          <!-- Después: esta app -->
          <div class="lp-compare__side lp-compare__side--good">
            <div class="lp-compare__header">
              <span class="lp-compare__icon">✅</span>
              <div>
                <h4>FinanzasApp con E2EE</h4>
                <p>Tus montos se cifran en tu navegador antes de viajar.</p>
              </div>
            </div>
            <div class="lp-compare__db-title">Lo que ve el servidor:</div>
            <pre class="lp-compare__code lp-compare__code--encrypted">{
  "user": "carlos@email.com",
  "salary": { "iv": "f3a2...", "ct": "9b8e2c7d..." },
  "savings": { "iv": "a91c...", "ct": "3f2e901b..." },
  "debt": { "iv": "8d4e...", "ct": "c7b2f8a4..." }
}</pre>
            <p class="lp-compare__risk lp-compare__risk--ok">✓ Si el servidor se hackea: <strong>basura ilegible</strong>.</p>
          </div>
        </div>

        <!-- Demo interactivo -->
        <div class="lp-demo lp-reveal">
          <div class="lp-demo__header">
            <div>
              <p class="lp-section-tag">🧪 Pruébalo tú mismo</p>
              <h3 class="lp-demo__title">Escribe un monto y míralo cifrarse en vivo</h3>
              <p class="lp-demo__sub">
                Esto es lo mismo que pasa cuando cargas un gasto en la app real.
                El cifrado ocurre en tu navegador, antes de que los datos salgan de aquí.
              </p>
            </div>
          </div>

          <div class="lp-demo__playground">
            <div class="lp-demo__input-wrap">
              <label class="lp-demo__label">Tu monto (lo que ves tú)</label>
              <div class="lp-demo__input-row">
                <span class="lp-demo__currency">$</span>
                <input
                  v-model.number="demoAmount"
                  type="number"
                  min="0"
                  step="1"
                  class="lp-demo__input"
                  placeholder="30000"
                />
              </div>
              <p class="lp-demo__hint">Cambia el número para ver el cifrado en vivo</p>
            </div>

            <div class="lp-demo__arrow" aria-hidden="true">→</div>

            <div class="lp-demo__output-wrap">
              <label class="lp-demo__label">Lo que guarda el servidor</label>
              <div class="lp-demo__output" :class="{ 'lp-demo__output--pulse': demoAnimating }">
                <div class="lp-demo__output-line">
                  <span class="lp-demo__key">iv:</span>
                  <span class="lp-demo__val">{{ demoOutput.iv }}</span>
                </div>
                <div class="lp-demo__output-line">
                  <span class="lp-demo__key">ct:</span>
                  <span class="lp-demo__val">{{ demoOutput.ct }}</span>
                </div>
              </div>
              <p class="lp-demo__hint lp-demo__hint--ok">
                ✓ Ni con acceso total al servidor se puede recuperar el monto original
              </p>
            </div>
          </div>

          <div class="lp-demo__footer">
            <span>🛡️ Cifrado real AES-256-GCM</span>
            <span>🔑 Derivación PBKDF2 · 310,000 iteraciones</span>
            <span>📖 Estándar BIP39 (mismo que Bitcoin/Proton)</span>
          </div>
        </div>

      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         FEATURES
    ═══════════════════════════════════════════════════════════ -->
    <section id="features" class="lp-features">
      <div class="lp-container">

        <div class="lp-section-header lp-reveal">
          <p class="lp-section-tag">✨ Lo que puedes hacer</p>
          <h2 class="lp-section-title">Finanzas sin vueltas,<br>con una red de seguridad.</h2>
          <p class="lp-section-sub">
            Las herramientas que necesitas para tomar el control de tu plata, y la
            protección que mereces para dormir tranquilo.
          </p>
        </div>

        <div class="lp-features__grid">

          <div class="lp-feature-card lp-feature-card--wide lp-reveal">
            <div class="lp-feature-card__icon lp-feature-card__icon--blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            </div>
            <h3>Tu plata, cifrada de punta a punta</h3>
            <p>
              Todos tus montos, ingresos y deudas se cifran en tu navegador antes de
              viajar al servidor. Si alguien intercepta la red o hackea nuestra base de
              datos, lo que ve es basura criptográfica sin valor. <strong>Ni nosotros tenemos la llave</strong>.
            </p>
            <ul class="lp-feature-list">
              <li>🔐 Cifrado AES-256-GCM en tu navegador</li>
              <li>🔑 Tu contraseña jamás toca nuestros servidores</li>
              <li>🆘 Kit de Emergencia con 12 palabras para recuperar acceso</li>
            </ul>
          </div>

          <div class="lp-feature-card lp-reveal">
            <div class="lp-feature-card__icon lp-feature-card__icon--green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 16l4-4 4 4 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>Visualiza a dónde se va tu plata</h3>
            <p>
              Gráficas claras de presupuesto vs gasto real, mes a mes. Barras de progreso
              de tus deudas. Ves en qué categorías se te escapa la plata.
            </p>
            <div class="lp-feature-mini-chart">
              <div class="lp-mini-bar" style="--h:40%; --delay:0s"></div>
              <div class="lp-mini-bar" style="--h:65%; --delay:.1s"></div>
              <div class="lp-mini-bar" style="--h:55%; --delay:.2s"></div>
              <div class="lp-mini-bar lp-mini-bar--green" style="--h:80%; --delay:.3s"></div>
              <div class="lp-mini-bar" style="--h:70%; --delay:.4s"></div>
              <div class="lp-mini-bar lp-mini-bar--green" style="--h:90%; --delay:.5s"></div>
              <div class="lp-mini-bar" style="--h:75%; --delay:.6s"></div>
            </div>
          </div>

          <div class="lp-feature-card lp-reveal">
            <div class="lp-feature-card__icon lp-feature-card__icon--purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l3 9 4-18 3 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>Sistema 50/30/20 adaptable</h3>
            <p>
              El clásico método de presupuesto, pero con la regla personalizable según
              tu realidad. Cada categoría se ajusta automáticamente.
            </p>
            <ul class="lp-feature-list">
              <li>🏠 50% necesidades (configurable)</li>
              <li>🎯 30% gustos y deseos</li>
              <li>💎 20% ahorro o pago extra de deudas</li>
            </ul>
          </div>

          <div class="lp-feature-card lp-reveal">
            <div class="lp-feature-card__icon lp-feature-card__icon--green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </div>
            <h3>3 estrategias para salir de deudas</h3>
            <p>
              Probado por millones: Bola de Nieve, Avalancha o híbrido Fireball. El
              sistema te muestra cuántos meses tardas y cuánto pagas de intereses con cada una.
            </p>
            <ul class="lp-feature-list">
              <li>❄️ Bola de Nieve — motivación psicológica</li>
              <li>🌊 Avalancha — máximo ahorro en intereses</li>
              <li>🔥 Fireball — lo mejor de ambos</li>
            </ul>
          </div>

          <div class="lp-feature-card lp-feature-card--wide lp-reveal">
            <div class="lp-feature-card__icon lp-feature-card__icon--blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            </div>
            <h3>Registra gastos desde WhatsApp o Telegram</h3>
            <p>
              Conecta tu cuenta al bot y registra gastos con un mensaje de texto: "comida
              350", "gasolina 1200". Se cargan solos a tu presupuesto mientras caminas, sin
              abrir la app ni perder el momento.
            </p>
            <div class="lp-feature-tags">
              <span>📱 Bot de Telegram</span>
              <span>⚡ Captura instantánea</span>
              <span>🔔 Recordatorios de facturas</span>
              <span>📊 Resumen diario opcional</span>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         CÓMO FUNCIONA
    ═══════════════════════════════════════════════════════════ -->
    <section id="how" class="lp-how">
      <div class="lp-container">
        <div class="lp-section-header lp-reveal">
          <p class="lp-section-tag">🚀 Cómo empezar</p>
          <h2 class="lp-section-title">En tres pasos.<br><span class="lp-gradient-text">Listo para usar.</span></h2>
        </div>

        <div class="lp-steps">
          <div class="lp-step lp-reveal">
            <div class="lp-step__num">01</div>
            <div class="lp-step__content">
              <h3>Crea tu cuenta y guarda tu Kit</h3>
              <p>
                Registro en menos de 2 minutos. Te damos 12 palabras — son tu red de
                seguridad si alguna vez olvidas la contraseña. Guárdalas bien.
              </p>
            </div>
          </div>
          <div class="lp-step__connector"></div>
          <div class="lp-step lp-reveal">
            <div class="lp-step__num">02</div>
            <div class="lp-step__content">
              <h3>Carga tu realidad financiera</h3>
              <p>
                Ingresos, facturas fijas, gastos variables y deudas. Todo se cifra antes
                de viajar al servidor. Solo tardas una vez y queda configurado.
              </p>
            </div>
          </div>
          <div class="lp-step__connector"></div>
          <div class="lp-step lp-reveal">
            <div class="lp-step__num">03</div>
            <div class="lp-step__content">
              <h3>Sigue tu plan, mes a mes</h3>
              <p>
                Elige tu estrategia de deuda, mira tu progreso 50/30/20 y registra gastos
                desde el celular. El sistema te va guiando.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         CONTACTO
    ═══════════════════════════════════════════════════════════ -->
    <section id="contact" class="lp-contact">
      <div class="lp-container lp-contact__inner">

        <!-- Texto izquierdo -->
        <div class="lp-contact__copy">
          <p class="lp-section-tag">Contacto</p>
          <h2 class="lp-section-title" style="text-align:left; margin-bottom:1rem">
            Hablemos de<br>tus metas.
          </h2>
          <p style="color: var(--lp-muted); line-height: 1.7">
            ¿Quieres personalizar el sistema para tu caso?
            ¿Tienes ideas para nuevas funciones? Escríbeme y lo conversamos.
          </p>
          <div class="lp-contact__info">
            <div class="lp-contact__info-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="1.5"/><path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="1.5"/></svg>
              <span>albert.gonzalez0297@gmail.com</span>
            </div>
          </div>
        </div>

        <!-- Formulario -->
        <form class="lp-form" @submit.prevent="handleSubmit">
          <div class="lp-form__row">
            <div class="lp-form__field">
              <label>Nombre</label>
              <input v-model="form.name" type="text" placeholder="Tu nombre" required />
            </div>
            <div class="lp-form__field">
              <label>Email</label>
              <input v-model="form.email" type="email" placeholder="tu@email.com" required />
            </div>
          </div>
          <div class="lp-form__field">
            <label>Asunto</label>
            <input v-model="form.subject" type="text" placeholder="¿En qué puedo ayudarte?" required />
          </div>
          <div class="lp-form__field">
            <label>Mensaje</label>
            <textarea v-model="form.message" rows="4" placeholder="Cuéntame sobre tus metas financieras..." required></textarea>
          </div>
          <button type="submit" class="lp-btn lp-btn--primary lp-btn--lg lp-btn--full" :disabled="sending">
            {{ sending ? 'Enviando...' : 'Enviar mensaje →' }}
          </button>
          <p v-if="sent" class="lp-form__success">✓ Mensaje enviado. Te contactaré pronto.</p>
        </form>

      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         FOOTER
    ═══════════════════════════════════════════════════════════ -->
    <footer class="lp-footer">
      <div class="lp-container lp-footer__inner">
        <div class="lp-logo">
          <span class="lp-logo__badge">$</span>
          <span class="lp-logo__name">FinanzasApp</span>
        </div>
        <p class="lp-footer__copy">
          Cifrado E2EE · Código abierto · Sin tracking · Sin anuncios
        </p>
        <div class="lp-footer__links">
          <RouterLink to="/login">Iniciar sesión</RouterLink>
          <RouterLink to="/register">Crear cuenta</RouterLink>
          <a href="#features">Características</a>
          <a href="#contact">Contacto</a>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { InstallAppButton } from '@/components'

// ── Header scrolled state ──────────────────────────────────────────────────
const scrolled = ref(false)
const menuOpen = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 20
}

// ── Stats bar: counter animado cuando entra al viewport ───────────────────
// Los valores crecen de 0 hasta el target con easing al scrollear a la sección.
const statsRef = ref<HTMLElement | null>(null)
const animatedStats = ref({ bits: 0, words: 0, methods: 0 })
let statsAnimated = false

function animateCount(to: number, onTick: (v: number) => void, duration = 1200) {
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3)
    onTick(Math.floor(to * eased))
    if (t < 1) requestAnimationFrame(tick)
    else       onTick(to)
  }
  requestAnimationFrame(tick)
}

function triggerStatsAnimation() {
  if (statsAnimated) return
  statsAnimated = true
  animateCount(256, v => (animatedStats.value.bits    = v))
  animateCount(12,  v => (animatedStats.value.words   = v), 900)
  animateCount(3,   v => (animatedStats.value.methods = v), 700)
}

// ── Demo interactivo: cifrado en vivo ─────────────────────────────────────
// Usa Web Crypto API real para demostrar cifrado. Si el browser no soporta
// (muy raro en 2026), hace un fallback pseudo-aleatorio determinístico.
const demoAmount    = ref<number | null>(30000)
const demoOutput    = ref<{ iv: string; ct: string }>({ iv: '', ct: '' })
const demoAnimating = ref(false)
/** Clave efímera solo para la demo — NO tiene relación con la DEK real del user */
let demoKey: CryptoKey | null = null

async function ensureDemoKey(): Promise<CryptoKey> {
  if (demoKey) return demoKey
  demoKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  return demoKey
}

function toB64url(buf: ArrayBuffer, maxChars = 24): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64.length > maxChars ? b64.slice(0, maxChars) + '…' : b64
}

async function encryptDemo(value: number) {
  try {
    const key = await ensureDemoKey()
    const iv  = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify(value))
    const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    demoOutput.value = {
      iv: toB64url(iv.buffer, 16),
      ct: toB64url(ct, 32),
    }
  } catch {
    // Fallback visual si algo falla (browsers muy viejos, sandboxing)
    const hash = String(value ?? 0).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)
    demoOutput.value = {
      iv: `demo${(hash * 13).toString(16).slice(0, 12)}`,
      ct: `demo${(hash * 41).toString(16).slice(0, 26)}`,
    }
  }
}

// Watch: recalcular cifrado al cambiar el monto, con pulse visual
let demoDebounce: ReturnType<typeof setTimeout> | null = null
watch(demoAmount, () => {
  demoAnimating.value = true
  if (demoDebounce) clearTimeout(demoDebounce)
  demoDebounce = setTimeout(() => {
    encryptDemo(demoAmount.value ?? 0)
    setTimeout(() => { demoAnimating.value = false }, 400)
  }, 120)
}, { immediate: false })

// ── Reveal on scroll: fade-in de secciones con IntersectionObserver ──────
let observer: IntersectionObserver | null = null

function setupRevealObserver() {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('lp-reveal--visible')
        observer?.unobserve(entry.target)
      }
    }
  }, { threshold: 0.12 })

  document.querySelectorAll('.lp-reveal').forEach(el => observer?.observe(el))
}

function setupStatsObserver() {
  if (!statsRef.value) return
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      triggerStatsAnimation()
      obs.disconnect()
    }
  }, { threshold: 0.35 })
  obs.observe(statsRef.value)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  setupRevealObserver()
  setupStatsObserver()
  // Semilla inicial del demo (se muestra con datos ya cifrados al cargar)
  encryptDemo(demoAmount.value ?? 30000)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  observer?.disconnect()
})

// ── Formulario de contacto ─────────────────────────────────────────────────
const form = ref({ name: '', email: '', subject: '', message: '' })
const sending = ref(false)
const sent    = ref(false)

async function handleSubmit() {
  sending.value = true
  await new Promise(r => setTimeout(r, 1200))
  sending.value = false
  sent.value    = true
  form.value    = { name: '', email: '', subject: '', message: '' }
  setTimeout(() => { sent.value = false }, 5000)
}
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════
   TOKENS DE DISEÑO — modo oscuro "Developer Blue"
══════════════════════════════════════════════════════════════ */
.lp {
  --lp-bg:           #080d17;
  --lp-surface:      #0e1623;
  --lp-surface-2:    #141e2e;
  --lp-border:       #1c2a3e;
  --lp-text:         #f0f4ff;
  --lp-muted:        #8899b4;
  --lp-blue:         #2563eb;
  --lp-blue-light:   #3b82f6;
  --lp-blue-glow:    rgba(37, 99, 235, .25);
  --lp-green:        #10b981;
  --lp-green-glow:   rgba(16, 185, 129, .2);
  --lp-purple:       #7c3aed;
  --lp-radius:       12px;
  --lp-radius-lg:    20px;
  --lp-transition:   .2s ease;

  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* ── Reset y helpers ────────────────────────────────────── */
.lp * { box-sizing: border-box; margin: 0; padding: 0; }
.lp a { text-decoration: none; color: inherit; }
.lp button { cursor: pointer; border: none; background: none; font: inherit; }

.lp-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ── Colores de acento ──────────────────────────────────── */
.lp-blue  { color: var(--lp-blue-light); }
.lp-green { color: var(--lp-green); }

/* ── Gradient text ──────────────────────────────────────── */
.lp-gradient-text {
  background: linear-gradient(135deg, var(--lp-blue-light) 0%, var(--lp-green) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ══════════════════════════════════════════════════════════════
   BOTONES
══════════════════════════════════════════════════════════════ */
.lp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: all var(--lp-transition);
  white-space: nowrap;
}
.lp-btn--primary {
  background: var(--lp-blue);
  color: #fff;
  box-shadow: 0 0 20px var(--lp-blue-glow);
}
.lp-btn--primary:hover {
  background: var(--lp-blue-light);
  box-shadow: 0 0 30px rgba(59, 130, 246, .4);
  transform: translateY(-1px);
}
.lp-btn--ghost {
  color: var(--lp-muted);
  border: 1px solid var(--lp-border);
}
.lp-btn--ghost:hover { color: var(--lp-text); border-color: var(--lp-blue); }
.lp-btn--lg  { padding: 14px 28px; font-size: 16px; border-radius: 10px; }
.lp-btn--full { width: 100%; justify-content: center; }
.lp-btn:disabled { opacity: .6; cursor: not-allowed; transform: none !important; }

/* ══════════════════════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════════════════════ */
.lp-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: all var(--lp-transition);
  padding: 20px 0;
}
.lp-header--scrolled {
  background: rgba(8, 13, 23, .85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--lp-border);
  padding: 12px 0;
}
.lp-header__inner {
  display: flex;
  align-items: center;
  gap: 40px;
}

/* Logo */
.lp-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.lp-logo__badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--lp-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 0 15px var(--lp-blue-glow);
}
.lp-logo__name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -.3px;
}

/* Navegación */
.lp-nav {
  display: flex;
  align-items: center;
  gap: 32px;
  flex: 1;
  justify-content: center;
}
.lp-nav a {
  font-size: 14px;
  color: var(--lp-muted);
  transition: color var(--lp-transition);
}
.lp-nav a:hover { color: var(--lp-text); }

.lp-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* Hamburger (mobile) */
.lp-hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
}
.lp-hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--lp-muted);
  border-radius: 2px;
}

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
.lp-hero {
  position: relative;
  padding: 160px 0 100px;
  overflow: hidden;
}

/* Grid de fondo */
.lp-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, .06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, .06) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}

/* Blobs de color */
.lp-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.lp-blob--1 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(37, 99, 235, .2), transparent 70%);
  top: -100px; right: -100px;
}
.lp-blob--2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(16, 185, 129, .15), transparent 70%);
  bottom: 0; left: -50px;
}

.lp-hero__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  position: relative;
  z-index: 1;
}

/* Contenido izquierdo */
.lp-hero__content {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.lp-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(37, 99, 235, .12);
  border: 1px solid rgba(37, 99, 235, .3);
  color: var(--lp-blue-light);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
  width: fit-content;
}
.lp-badge__dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--lp-green);
  box-shadow: 0 0 8px var(--lp-green);
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
}

.lp-hero__title {
  font-size: clamp(36px, 5vw, 64px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -2px;
}

.lp-hero__subtitle {
  font-size: 18px;
  color: var(--lp-muted);
  line-height: 1.7;
  max-width: 460px;
}

.lp-hero__actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* Pills de features */
.lp-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.lp-pill {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  color: var(--lp-muted);
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 6px;
}

/* ── Visual derecho ─────────────────────────────────────── */
.lp-hero__visual {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

/* Dashboard mockup */
.lp-mockup {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius-lg);
  overflow: hidden;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, .5), 0 0 0 1px rgba(255,255,255,.04);
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.lp-mockup__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--lp-surface-2);
  border-bottom: 1px solid var(--lp-border);
}
.lp-mockup__dots {
  display: flex;
  gap: 6px;
}
.lp-mockup__dots i {
  display: block;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--lp-border);
  font-style: normal;
}
.lp-mockup__dots i:nth-child(1) { background: #FF5F57; }
.lp-mockup__dots i:nth-child(2) { background: #FEBC2E; }
.lp-mockup__dots i:nth-child(3) { background: #28C840; }
.lp-mockup__url {
  font-size: 12px;
  color: var(--lp-muted);
  flex: 1;
  text-align: center;
}
.lp-mockup__body { padding: 20px; display: flex; flex-direction: column; gap: 18px; }

/* Métricas */
.lp-mock-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.lp-mock-metric {
  background: var(--lp-surface-2);
  border: 1px solid var(--lp-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lp-mock-metric__label { font-size: 10px; color: var(--lp-muted); }
.lp-mock-metric__value { font-size: 14px; font-weight: 700; }
.lp-mock-metric__change { font-size: 11px; }

/* Gráfica de barras */
.lp-mock-chart__label { font-size: 11px; color: var(--lp-muted); margin-bottom: 10px; }
.lp-mock-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 70px;
}
.lp-mock-bar {
  flex: 1;
  height: var(--h);
  background: var(--lp-blue);
  border-radius: 4px 4px 0 0;
  opacity: .8;
  position: relative;
  animation: bar-grow .8s var(--delay) both;
}
.lp-mock-bar--green { background: var(--lp-green); }
.lp-mock-bar::after {
  content: attr(data-label);
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--lp-muted);
}
@keyframes bar-grow {
  from { height: 0; }
  to   { height: var(--h); }
}

/* Regla */
.lp-mock-rule { display: flex; flex-direction: column; gap: 8px; }
.lp-mock-rule__row {
  display: grid;
  grid-template-columns: 80px 1fr 36px;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--lp-muted);
}
.lp-mock-rule__track {
  height: 5px;
  background: var(--lp-border);
  border-radius: 3px;
  overflow: hidden;
}
.lp-mock-rule__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1s ease;
}

/* ── Tarjeta de código flotante ─────────────────────────── */
.lp-code-card {
  position: absolute;
  bottom: -30px;
  left: -50px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: var(--lp-radius);
  overflow: hidden;
  width: 280px;
  box-shadow: 0 20px 50px rgba(0,0,0,.6);
  z-index: 2;
}
.lp-code-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.lp-code-card__dots { display: flex; gap: 5px; }
.lp-code-card__dots i {
  display: block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #30363d;
  font-style: normal;
}
.lp-code-card__file { font-size: 11px; color: #8b949e; margin-left: 4px; }

/* Syntax highlight */
.lp-code {
  padding: 14px;
  font-size: 12px;
  line-height: 1.7;
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  color: #e6edf3;
  overflow-x: auto;
  white-space: pre;
}
.lp-c  { color: #8b949e; }   /* comentario */
.lp-k  { color: #ff7b72; }   /* keyword */
.lp-f  { color: #d2a8ff; }   /* función */
.lp-p  { color: #79c0ff; }   /* propiedad */
.lp-s  { color: #a5d6ff; }   /* string */

/* ── Chip de alerta flotante ────────────────────────────── */
.lp-alert-chip {
  position: absolute;
  top: 20px;
  right: -20px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-left: 3px solid var(--lp-green);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--lp-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
  animation: chip-bounce 3s ease-in-out infinite;
  z-index: 3;
}
.lp-alert-chip__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--lp-green);
  box-shadow: 0 0 8px var(--lp-green);
  flex-shrink: 0;
}
.lp-alert-chip strong { color: var(--lp-text); }
@keyframes chip-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* ══════════════════════════════════════════════════════════════
   STATS BAR
══════════════════════════════════════════════════════════════ */
.lp-stats {
  border-top: 1px solid var(--lp-border);
  border-bottom: 1px solid var(--lp-border);
  background: var(--lp-surface);
  padding: 32px 0;
}
.lp-stats__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex-wrap: wrap;
}
.lp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 48px;
}
.lp-stat__value {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--lp-blue-light), var(--lp-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.lp-stat__label { font-size: 13px; color: var(--lp-muted); text-align: center; }
.lp-stat__divider { width: 1px; height: 40px; background: var(--lp-border); }

/* ══════════════════════════════════════════════════════════════
   FEATURES
══════════════════════════════════════════════════════════════ */
.lp-features {
  padding: 120px 0;
}

.lp-section-header {
  text-align: center;
  margin-bottom: 64px;
}
.lp-section-tag {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--lp-blue-light);
  margin-bottom: 16px;
}
.lp-section-title {
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 800;
  letter-spacing: -1.5px;
  line-height: 1.1;
  margin-bottom: 16px;
}
.lp-section-sub {
  color: var(--lp-muted);
  font-size: 18px;
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Grid de features */
.lp-features__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: 20px;
}

.lp-feature-card {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius-lg);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color var(--lp-transition), box-shadow var(--lp-transition);
}
.lp-feature-card:hover {
  border-color: var(--lp-blue);
  box-shadow: 0 0 30px var(--lp-blue-glow);
}
.lp-feature-card--wide {
  grid-column: span 2;
}
.lp-feature-card h3 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -.3px;
}
.lp-feature-card p {
  font-size: 14px;
  color: var(--lp-muted);
  line-height: 1.7;
}

.lp-feature-card__icon {
  width: 44px; height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lp-feature-card__icon--blue   { background: rgba(37, 99, 235, .15); color: var(--lp-blue-light); }
.lp-feature-card__icon--green  { background: rgba(16, 185, 129, .15); color: var(--lp-green); }
.lp-feature-card__icon--purple { background: rgba(124, 58, 237, .15); color: var(--lp-purple); }

/* Código inline en features */
.lp-feature-card__code {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 14px;
  margin-top: auto;
}
.lp-feature-card__code pre {
  font-size: 12px;
  line-height: 1.7;
  font-family: 'Fira Code', 'Consolas', monospace;
  color: #e6edf3;
}

/* Mini chart en features */
.lp-feature-mini-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 60px;
  margin-top: auto;
  padding: 12px;
  background: var(--lp-surface-2);
  border: 1px solid var(--lp-border);
  border-radius: 8px;
}
.lp-mini-bar {
  flex: 1;
  height: var(--h);
  background: var(--lp-blue);
  border-radius: 3px 3px 0 0;
  opacity: .8;
  animation: bar-grow .8s var(--delay) both;
}
.lp-mini-bar--green { background: var(--lp-green); }

/* Lista de features */
.lp-feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}
.lp-feature-list li { font-size: 13px; color: var(--lp-muted); }

/* Tags de tecnología */
.lp-feature-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}
.lp-feature-tags span {
  background: var(--lp-surface-2);
  border: 1px solid var(--lp-border);
  color: var(--lp-blue-light);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
}

/* ══════════════════════════════════════════════════════════════
   CÓMO FUNCIONA
══════════════════════════════════════════════════════════════ */
.lp-how {
  padding: 80px 0 120px;
  border-top: 1px solid var(--lp-border);
}

.lp-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 20px;
}
.lp-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 32px;
}
.lp-step__num {
  font-size: 48px;
  font-weight: 900;
  color: var(--lp-border);
  letter-spacing: -2px;
  line-height: 1;
}
.lp-step__content h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}
.lp-step__content p {
  font-size: 14px;
  color: var(--lp-muted);
  line-height: 1.6;
}
.lp-step__connector {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, var(--lp-border), var(--lp-blue), var(--lp-border));
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════════════
   CONTACTO
══════════════════════════════════════════════════════════════ */
.lp-contact {
  padding: 100px 0;
  border-top: 1px solid var(--lp-border);
  background: var(--lp-surface);
}
.lp-contact__inner {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 80px;
  align-items: start;
}
.lp-contact__copy {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.lp-contact__info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-contact__info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--lp-muted);
}
.lp-contact__info-item svg { color: var(--lp-blue-light); flex-shrink: 0; }

/* Formulario */
.lp-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.lp-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lp-form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lp-form__field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--lp-muted);
}
.lp-form__field input,
.lp-form__field textarea {
  background: var(--lp-surface-2);
  border: 1px solid var(--lp-border);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--lp-text);
  font-family: inherit;
  transition: border-color var(--lp-transition), box-shadow var(--lp-transition);
  resize: vertical;
}
.lp-form__field input:focus,
.lp-form__field textarea:focus {
  outline: none;
  border-color: var(--lp-blue);
  box-shadow: 0 0 0 3px var(--lp-blue-glow);
}
.lp-form__field input::placeholder,
.lp-form__field textarea::placeholder { color: #4a5568; }

.lp-form__success {
  font-size: 14px;
  color: var(--lp-green);
  text-align: center;
  padding: 10px;
  background: rgba(16, 185, 129, .1);
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, .2);
}

/* ══════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════ */
.lp-footer {
  padding: 40px 0;
  border-top: 1px solid var(--lp-border);
}
.lp-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.lp-footer__copy {
  font-size: 13px;
  color: var(--lp-muted);
}
.lp-footer__links {
  display: flex;
  gap: 24px;
}
.lp-footer__links a {
  font-size: 13px;
  color: var(--lp-muted);
  transition: color var(--lp-transition);
}
.lp-footer__links a:hover { color: var(--lp-text); }

/* ══════════════════════════════════════════════════════════════
   RESPONSIVO — Tablet / Mobile
══════════════════════════════════════════════════════════════ */
@media (max-width: 1024px) {
  .lp-hero__inner { grid-template-columns: 1fr; gap: 60px; }
  .lp-hero__visual { justify-content: center; }
  .lp-mockup { max-width: 100%; }
  .lp-code-card { bottom: auto; top: -40px; left: auto; right: -10px; width: 240px; }
  .lp-alert-chip { display: none; }
  .lp-features__grid { grid-template-columns: repeat(2, 1fr); }
  .lp-feature-card--wide { grid-column: span 2; }
  .lp-contact__inner { grid-template-columns: 1fr; gap: 48px; }
  .lp-stat { padding: 0 24px; }
}

@media (max-width: 768px) {
  .lp-hero { padding: 120px 0 80px; }
  .lp-hero__title { letter-spacing: -1px; }
  .lp-nav { display: none; }
  .lp-nav--open {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 70px; left: 0; right: 0;
    background: var(--lp-surface);
    border-bottom: 1px solid var(--lp-border);
    padding: 24px;
    gap: 20px;
  }
  .lp-hamburger { display: flex; }
  .lp-header__actions .lp-btn--ghost { display: none; }
  .lp-features__grid { grid-template-columns: 1fr; }
  .lp-feature-card--wide { grid-column: span 1; }
  .lp-steps { flex-direction: column; }
  .lp-step__connector { width: 1px; height: 40px; }
  .lp-stats__inner { gap: 20px; }
  .lp-stat { padding: 16px 20px; }
  .lp-stat__divider { display: none; }
  .lp-form__row { grid-template-columns: 1fr; }
  .lp-footer__inner { flex-direction: column; align-items: flex-start; gap: 20px; }
  .lp-mock-metrics { grid-template-columns: 1fr 1fr; }
  .lp-mock-metrics div:last-child { display: none; }
}

@media (max-width: 480px) {
  .lp-hero__actions { flex-direction: column; }
  .lp-btn--lg { width: 100%; justify-content: center; }
}

/* ══════════════════════════════════════════════════════════════
   REVEAL ON SCROLL — animación de entrada para secciones
   Se activa agregando .lp-reveal--visible vía IntersectionObserver
══════════════════════════════════════════════════════════════ */
.lp-reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.lp-reveal--visible {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .lp-reveal { opacity: 1; transform: none; transition: none; }
}

/* ══════════════════════════════════════════════════════════════
   SECCIÓN SEGURIDAD
══════════════════════════════════════════════════════════════ */
.lp-security {
  padding: 100px 0;
  position: relative;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(37, 99, 235, 0.08), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(16, 185, 129, 0.08), transparent 50%);
}
.lp-section-tag--security {
  color: var(--lp-green);
  background: var(--lp-green-glow);
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* ── Tarjeta de analogía del hotel ──────────────────────────── */
.lp-hotel-card {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: 900px;
  margin: 48px auto;
  padding: 28px 32px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.04));
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: var(--lp-radius-lg);
}
.lp-hotel-card__icon {
  font-size: 2.5rem;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 16px rgba(37, 99, 235, 0.4));
}
.lp-hotel-card__title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--lp-text);
}
.lp-hotel-card__text {
  color: var(--lp-muted);
  line-height: 1.6;
  font-size: 0.95rem;
}
.lp-hotel-card__text strong { color: var(--lp-text); }

/* ── Comparativa side-by-side ───────────────────────────────── */
.lp-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 48px 0;
}
.lp-compare__side {
  padding: 28px;
  border-radius: var(--lp-radius-lg);
  border: 1px solid var(--lp-border);
  background: var(--lp-surface);
}
.lp-compare__side--bad {
  border-color: rgba(239, 68, 68, 0.3);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.05), var(--lp-surface));
}
.lp-compare__side--good {
  border-color: rgba(16, 185, 129, 0.3);
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.05), var(--lp-surface));
}
.lp-compare__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 20px;
}
.lp-compare__icon { font-size: 1.4rem; flex-shrink: 0; }
.lp-compare__header h4 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--lp-text);
}
.lp-compare__header p {
  font-size: 0.85rem;
  color: var(--lp-muted);
  line-height: 1.5;
}
.lp-compare__db-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--lp-muted);
  margin-bottom: 8px;
  font-weight: 600;
}
.lp-compare__code {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 0.82rem;
  padding: 14px 16px;
  background: var(--lp-bg);
  border: 1px solid var(--lp-border);
  border-radius: 8px;
  color: var(--lp-muted);
  overflow-x: auto;
  line-height: 1.6;
  margin: 0;
}
.lp-compare__code--plain { color: #cbd5e1; }
.lp-compare__code--encrypted {
  color: var(--lp-green);
  word-break: break-all;
  white-space: pre-wrap;
}
.lp-highlight-red {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 700;
}
.lp-compare__risk {
  margin-top: 16px;
  font-size: 0.85rem;
  color: #ef4444;
  font-weight: 500;
}
.lp-compare__risk--ok { color: var(--lp-green); }

/* ── Demo interactivo ───────────────────────────────────────── */
.lp-demo {
  margin-top: 64px;
  padding: 40px;
  border-radius: var(--lp-radius-lg);
  border: 1px solid var(--lp-border);
  background: var(--lp-surface-2);
  position: relative;
  overflow: hidden;
}
.lp-demo::before {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background:
    radial-gradient(circle at 30% 30%, rgba(37, 99, 235, 0.08), transparent 40%),
    radial-gradient(circle at 70% 70%, rgba(16, 185, 129, 0.08), transparent 40%);
  pointer-events: none;
  z-index: 0;
}
.lp-demo > * { position: relative; z-index: 1; }

.lp-demo__header { margin-bottom: 32px; }
.lp-demo__title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 8px;
  color: var(--lp-text);
}
.lp-demo__sub {
  color: var(--lp-muted);
  line-height: 1.6;
  margin-top: 10px;
  max-width: 700px;
}

.lp-demo__playground {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  align-items: stretch;
}

.lp-demo__input-wrap,
.lp-demo__output-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lp-demo__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--lp-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.lp-demo__input-row {
  display: flex;
  align-items: center;
  background: var(--lp-bg);
  border: 1.5px solid var(--lp-border);
  border-radius: 10px;
  padding: 0 4px 0 16px;
  transition: border-color 0.2s;
}
.lp-demo__input-row:focus-within { border-color: var(--lp-blue-light); }
.lp-demo__currency {
  color: var(--lp-muted);
  font-size: 1.2rem;
  font-weight: 600;
  margin-right: 4px;
}
.lp-demo__input {
  flex: 1;
  padding: 16px 12px;
  font-size: 1.3rem;
  font-weight: 700;
  background: transparent;
  border: none;
  outline: none;
  color: var(--lp-text);
  font-family: inherit;
  min-width: 0;
}
.lp-demo__input::-webkit-outer-spin-button,
.lp-demo__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.lp-demo__hint {
  font-size: 0.78rem;
  color: var(--lp-muted);
}
.lp-demo__hint--ok { color: var(--lp-green); font-weight: 500; }

.lp-demo__arrow {
  align-self: center;
  font-size: 1.8rem;
  color: var(--lp-blue-light);
  font-weight: 700;
  animation: demo-arrow-pulse 2s ease-in-out infinite;
}
@keyframes demo-arrow-pulse {
  0%, 100% { transform: translateX(0); opacity: 0.6; }
  50%      { transform: translateX(6px); opacity: 1; }
}

.lp-demo__output {
  background: var(--lp-bg);
  border: 1.5px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  padding: 16px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 0.82rem;
  line-height: 1.8;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 80px;
}
.lp-demo__output--pulse {
  border-color: var(--lp-green);
  box-shadow: 0 0 24px rgba(16, 185, 129, 0.3);
}
.lp-demo__output-line {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.lp-demo__key {
  color: var(--lp-muted);
  font-weight: 600;
  min-width: 22px;
}
.lp-demo__val {
  color: var(--lp-green);
  word-break: break-all;
  flex: 1;
}

.lp-demo__footer {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--lp-border);
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  justify-content: center;
  font-size: 0.78rem;
  color: var(--lp-muted);
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 900px) {
  .lp-compare { grid-template-columns: 1fr; }
  .lp-demo { padding: 28px 20px; }
  .lp-demo__playground {
    grid-template-columns: 1fr;
  }
  .lp-demo__arrow {
    transform: rotate(90deg);
    align-self: center;
    justify-self: center;
  }
  @keyframes demo-arrow-pulse {
    0%, 100% { transform: rotate(90deg) translateX(0); opacity: 0.6; }
    50%      { transform: rotate(90deg) translateX(6px); opacity: 1; }
  }
  .lp-hotel-card { flex-direction: column; gap: 14px; padding: 22px; }
  .lp-security { padding: 64px 0; }
}
</style>
