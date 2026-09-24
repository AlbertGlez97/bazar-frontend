<template>
  <div class="guide-view">
    <!-- Sidebar con índice completo -->
    <aside class="guide-sidebar" :class="{ 'guide-sidebar--open': sidebarOpen }">
      <div class="guide-sidebar__header">
        <h2 class="guide-sidebar__title">📖 Guía</h2>
        <button class="guide-sidebar__close" @click="sidebarOpen = false" aria-label="Cerrar menú">✕</button>
      </div>

      <nav class="guide-nav">
        <div v-for="cat in categoriesInOrder" :key="cat.key" class="guide-nav__section">
          <div class="guide-nav__section-head">
            <span class="guide-nav__icon">{{ cat.icon }}</span>
            <span class="guide-nav__section-title">{{ cat.title }}</span>
          </div>
          <ul class="guide-nav__list">
            <li v-for="a in articlesByCategory(cat.key)" :key="a.slug">
              <router-link
                :to="{ name: 'GuideArticle', params: { slug: a.slug } }"
                class="guide-nav__link"
                :class="{ 'guide-nav__link--active': route.params.slug === a.slug }"
                @click="sidebarOpen = false"
              >
                {{ a.title }}
              </router-link>
            </li>
            <li v-if="!articlesByCategory(cat.key).length" class="guide-nav__empty">
              Próximamente…
            </li>
          </ul>
        </div>
      </nav>
    </aside>

    <!-- Toggle mobile -->
    <button class="guide-toggle" @click="sidebarOpen = true" aria-label="Abrir índice">
      ☰ Índice
    </button>

    <!-- Contenido principal: home o artículo -->
    <main class="guide-content">
      <!-- ── Home de la guía ─────────────────────────────────────────── -->
      <template v-if="!route.params.slug">
        <header class="guide-hero">
          <h1 class="guide-hero__title">📖 Guía financiera</h1>
          <p class="guide-hero__subtitle">
            Entiende los conceptos, aprende a usar el sistema y toma mejores decisiones con tu plata.
            Todo con fuentes verificadas de CONDUSEF, Banxico y BBVA México.
          </p>
        </header>

        <section v-for="cat in categoriesInOrder" :key="cat.key" class="guide-section">
          <div class="guide-section__head">
            <span class="guide-section__icon">{{ cat.icon }}</span>
            <div>
              <h2 class="guide-section__title">{{ cat.title }}</h2>
              <p class="guide-section__desc">{{ cat.description }}</p>
            </div>
          </div>

          <div v-if="articlesByCategory(cat.key).length" class="guide-card-grid">
            <router-link
              v-for="a in articlesByCategory(cat.key)"
              :key="a.slug"
              :to="{ name: 'GuideArticle', params: { slug: a.slug } }"
              class="guide-card"
            >
              <h3 class="guide-card__title">{{ a.title }}</h3>
              <p class="guide-card__summary">{{ a.summary }}</p>
              <div class="guide-card__footer">
                <span class="guide-card__time">⏱ {{ a.readTime }}</span>
                <span class="guide-card__arrow">→</span>
              </div>
            </router-link>
          </div>
          <div v-else class="guide-section__soon">
            Artículos de esta sección en camino. Pronto los vas a poder leer aquí.
          </div>
        </section>
      </template>

      <!-- ── Artículo individual ───────────────────────────────────── -->
      <template v-else-if="currentArticle">
        <nav class="guide-breadcrumb">
          <router-link :to="{ name: 'GuideHome' }" class="guide-breadcrumb__link">Guía</router-link>
          <span class="guide-breadcrumb__sep">›</span>
          <span class="guide-breadcrumb__cat">{{ CATEGORIES[currentArticle.category].title }}</span>
          <span class="guide-breadcrumb__sep">›</span>
          <span class="guide-breadcrumb__current">{{ currentArticle.title }}</span>
        </nav>

        <article class="guide-article">
          <header class="guide-article__header">
            <h1 class="guide-article__title">{{ currentArticle.title }}</h1>
            <div class="guide-article__meta">
              <span class="guide-article__cat">
                {{ CATEGORIES[currentArticle.category].icon }} {{ CATEGORIES[currentArticle.category].title }}
              </span>
              <span class="guide-article__time">⏱ {{ currentArticle.readTime }} de lectura</span>
            </div>
            <p class="guide-article__summary">{{ currentArticle.summary }}</p>
          </header>

          <div v-for="(sec, i) in currentArticle.sections" :key="i" class="guide-article__section">
            <h2 v-if="sec.heading" class="guide-article__heading">{{ sec.heading }}</h2>
            <p v-for="(p, pi) in sec.paragraphs" :key="'p' + pi" class="guide-article__p">{{ p }}</p>

            <ul v-if="sec.list" class="guide-article__list">
              <li v-for="(item, li) in sec.list" :key="'l' + li">{{ item }}</li>
            </ul>

            <div v-if="sec.example" class="guide-example">
              <div class="guide-example__title">📐 {{ sec.example.title }}</div>
              <pre class="guide-example__body">{{ sec.example.lines.join('\n') }}</pre>
            </div>

            <div v-if="sec.callout" class="guide-callout" :class="`guide-callout--${sec.callout.kind}`">
              <span class="guide-callout__icon">
                {{ sec.callout.kind === 'warn' ? '⚠️' : sec.callout.kind === 'tip' ? '💡' : 'ℹ️' }}
              </span>
              <span>{{ sec.callout.text }}</span>
            </div>
          </div>

          <!-- Fuentes -->
          <footer class="guide-sources">
            <h3 class="guide-sources__title">📚 Fuentes consultadas</h3>
            <p class="guide-sources__intro">
              Este artículo se basa en información pública de instituciones reconocidas.
              Haz clic en cada fuente si quieres profundizar o verificar.
            </p>
            <ul class="guide-sources__list">
              <li v-for="(src, si) in currentArticle.sources" :key="'s' + si">
                <a :href="src.url" target="_blank" rel="noopener noreferrer" class="guide-source">
                  <span class="guide-source__org" :class="`guide-source__org--${src.org.toLowerCase()}`">
                    {{ src.org }}
                  </span>
                  <span class="guide-source__label">{{ src.label }}</span>
                  <span class="guide-source__ext">↗</span>
                </a>
              </li>
            </ul>
          </footer>

          <!-- Artículos relacionados -->
          <section v-if="relatedArticles.length" class="guide-related">
            <h3 class="guide-related__title">🔗 Artículos relacionados</h3>
            <div class="guide-card-grid">
              <router-link
                v-for="a in relatedArticles"
                :key="a.slug"
                :to="{ name: 'GuideArticle', params: { slug: a.slug } }"
                class="guide-card guide-card--sm"
              >
                <h4 class="guide-card__title">{{ a.title }}</h4>
                <p class="guide-card__summary">{{ a.summary }}</p>
              </router-link>
            </div>
          </section>

          <!-- Navegación anterior/siguiente -->
          <nav class="guide-pager">
            <router-link
              v-if="prev"
              :to="{ name: 'GuideArticle', params: { slug: prev.slug } }"
              class="guide-pager__btn guide-pager__btn--prev"
            >
              <span class="guide-pager__dir">← Anterior</span>
              <span class="guide-pager__label">{{ prev.title }}</span>
            </router-link>
            <span v-else></span>

            <router-link
              v-if="next"
              :to="{ name: 'GuideArticle', params: { slug: next.slug } }"
              class="guide-pager__btn guide-pager__btn--next"
            >
              <span class="guide-pager__dir">Siguiente →</span>
              <span class="guide-pager__label">{{ next.title }}</span>
            </router-link>
          </nav>
        </article>
      </template>

      <!-- ── Artículo no encontrado ─────────────────────────────────── -->
      <template v-else>
        <div class="guide-404">
          <h1>Artículo no encontrado</h1>
          <p>El artículo que buscas no existe o fue movido.</p>
          <router-link :to="{ name: 'GuideHome' }" class="guide-404__link">← Volver al índice</router-link>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  CATEGORIES,
  findArticle, articlesByCategory, neighbors,
  type GuideCategory, type GuideArticle,
} from './guide.data'

const route = useRoute()
const sidebarOpen = ref(false)

const categoriesInOrder = computed(() =>
  (['conceptos', 'sistema', 'seguridad'] as GuideCategory[]).map(key => ({
    key,
    ...CATEGORIES[key],
  }))
)

const currentArticle = computed<GuideArticle | undefined>(() => {
  const slug = route.params.slug
  if (typeof slug !== 'string') return undefined
  return findArticle(slug)
})

const prev = computed<GuideArticle | undefined>(() =>
  currentArticle.value ? neighbors(currentArticle.value.slug).prev : undefined
)
const next = computed<GuideArticle | undefined>(() =>
  currentArticle.value ? neighbors(currentArticle.value.slug).next : undefined
)

const relatedArticles = computed<GuideArticle[]>(() => {
  if (!currentArticle.value?.related) return []
  return currentArticle.value.related
    .map(slug => findArticle(slug))
    .filter((a): a is GuideArticle => !!a)
})
</script>

<style scoped>
.guide-view {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-lg);
  min-height: calc(100vh - 120px);
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Sidebar ───────────────────────────────────────────────────────── */
.guide-sidebar {
  position: sticky;
  top: var(--space-lg);
  align-self: start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-md);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.guide-sidebar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}
.guide-sidebar__title { font-size: 1.1rem; font-weight: 700; margin: 0; }
.guide-sidebar__close {
  background: none; border: none; font-size: 1.2rem; cursor: pointer;
  color: var(--color-text-muted); display: none;
}

.guide-nav__section { margin-bottom: var(--space-md); }
.guide-nav__section-head {
  display: flex; gap: 8px; align-items: center;
  font-size: 0.75rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--color-text-muted);
  margin-bottom: 6px; padding: 0 8px;
}
.guide-nav__list { list-style: none; padding: 0; margin: 0; }
.guide-nav__link {
  display: block; padding: 8px 12px;
  color: var(--color-text); text-decoration: none;
  font-size: 0.88rem; border-radius: var(--radius-sm);
  line-height: 1.3;
}
.guide-nav__link:hover { background: rgba(59, 130, 246, 0.08); }
.guide-nav__link--active {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
}
.guide-nav__empty {
  padding: 8px 12px; font-size: 0.8rem;
  color: var(--color-text-muted); font-style: italic;
}

.guide-toggle {
  display: none;
  position: fixed; top: 72px; left: var(--space-md); z-index: 10;
  background: var(--color-surface); border: 1px solid var(--color-border);
  padding: 8px 14px; border-radius: var(--radius-sm); cursor: pointer;
  font-size: 0.85rem; color: var(--color-text);
}

/* ── Contenido ─────────────────────────────────────────────────────── */
.guide-content { min-width: 0; }

.guide-hero {
  padding: var(--space-lg) 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-lg);
}
.guide-hero__title { font-size: 2rem; font-weight: 800; margin: 0 0 12px; }
.guide-hero__subtitle {
  color: var(--color-text-muted); font-size: 1rem; line-height: 1.5;
  max-width: 720px; margin: 0;
}

.guide-section { margin-bottom: var(--space-xl, 48px); }
.guide-section__head {
  display: flex; gap: var(--space-sm); align-items: flex-start;
  margin-bottom: var(--space-md);
}
.guide-section__icon { font-size: 1.8rem; line-height: 1; }
.guide-section__title { font-size: 1.3rem; font-weight: 700; margin: 0 0 4px; }
.guide-section__desc { color: var(--color-text-muted); margin: 0; font-size: 0.9rem; }
.guide-section__soon {
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  font-style: italic;
}

.guide-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md);
}
.guide-card {
  display: flex; flex-direction: column;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: var(--space-md);
  text-decoration: none; color: inherit;
  transition: transform 0.15s, border-color 0.15s;
}
.guide-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary, #3b82f6);
}
.guide-card--sm { padding: var(--space-sm) var(--space-md); }
.guide-card__title { font-size: 1rem; font-weight: 700; margin: 0 0 8px; color: var(--color-text); }
.guide-card__summary { font-size: 0.88rem; color: var(--color-text-muted); line-height: 1.4; margin: 0 0 12px; flex: 1; }
.guide-card__footer {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; color: var(--color-text-muted);
  padding-top: 8px; border-top: 1px solid var(--color-border);
}
.guide-card__arrow { color: var(--color-primary, #3b82f6); font-weight: 600; }

/* ── Breadcrumb ────────────────────────────────────────────────────── */
.guide-breadcrumb {
  display: flex; gap: 8px; align-items: center;
  font-size: 0.85rem; color: var(--color-text-muted);
  margin-bottom: var(--space-md); flex-wrap: wrap;
}
.guide-breadcrumb__link { color: var(--color-primary, #3b82f6); text-decoration: none; }
.guide-breadcrumb__link:hover { text-decoration: underline; }
.guide-breadcrumb__sep { opacity: 0.5; }
.guide-breadcrumb__current { color: var(--color-text); font-weight: 500; }

/* ── Artículo ──────────────────────────────────────────────────────── */
.guide-article { max-width: 760px; }
.guide-article__header { margin-bottom: var(--space-lg); padding-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); }
.guide-article__title { font-size: 1.8rem; font-weight: 800; margin: 0 0 12px; line-height: 1.2; }
.guide-article__meta { display: flex; gap: var(--space-md); flex-wrap: wrap; font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 12px; }
.guide-article__summary { font-size: 1.05rem; line-height: 1.5; color: var(--color-text); font-style: italic; margin: 0; }

.guide-article__section { margin-bottom: var(--space-lg); }
.guide-article__heading { font-size: 1.25rem; font-weight: 700; margin: 0 0 12px; color: var(--color-text); }
.guide-article__p { font-size: 1rem; line-height: 1.65; color: var(--color-text); margin: 0 0 12px; }
.guide-article__list { padding-left: 24px; margin: 12px 0; }
.guide-article__list li { margin-bottom: 8px; line-height: 1.5; }

.guide-example {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm); padding: var(--space-md);
  margin: var(--space-md) 0;
}
.guide-example__title { font-weight: 600; font-size: 0.88rem; margin-bottom: 8px; color: var(--color-primary, #3b82f6); }
.guide-example__body {
  font-family: var(--font-mono, 'Menlo', 'Consolas', monospace);
  font-size: 0.82rem; line-height: 1.55;
  white-space: pre-wrap; margin: 0; color: var(--color-text);
}

.guide-callout {
  display: flex; gap: 10px; align-items: flex-start;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  margin: var(--space-md) 0;
  font-size: 0.9rem; line-height: 1.5;
}
.guide-callout--info { background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; }
.guide-callout--warn { background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; }
.guide-callout--tip  { background: rgba(34, 197, 94, 0.08);  border-left: 3px solid #22c55e; }
.guide-callout__icon { font-size: 1.1rem; flex-shrink: 0; }

/* ── Fuentes ───────────────────────────────────────────────────────── */
.guide-sources {
  margin-top: var(--space-xl, 48px);
  padding-top: var(--space-lg);
  border-top: 2px solid var(--color-border);
}
.guide-sources__title { font-size: 1.1rem; font-weight: 700; margin: 0 0 8px; }
.guide-sources__intro { font-size: 0.88rem; color: var(--color-text-muted); margin: 0 0 var(--space-md); }
.guide-sources__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.guide-source {
  display: flex; gap: 10px; align-items: center;
  padding: 10px 12px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-decoration: none; color: inherit;
  transition: border-color 0.15s;
}
.guide-source:hover { border-color: var(--color-primary, #3b82f6); }
.guide-source__org {
  font-size: 0.7rem; font-weight: 700; padding: 3px 8px;
  border-radius: 4px; flex-shrink: 0; text-transform: uppercase;
  letter-spacing: 0.03em;
}
.guide-source__org--condusef { background: #dbeafe; color: #1e40af; }
.guide-source__org--banxico  { background: #fee2e2; color: #991b1b; }
.guide-source__org--bbva     { background: #dcfce7; color: #166534; }
.guide-source__org--profeco  { background: #fef3c7; color: #92400e; }
.guide-source__org--incibe   { background: #ede9fe; color: #5b21b6; }
.guide-source__org--osi      { background: #e0e7ff; color: #3730a3; }
.guide-source__org--proton   { background: #fce7f3; color: #9f1239; }
.guide-source__org--otro     { background: var(--color-border); color: var(--color-text-muted); }
.guide-source__label { flex: 1; font-size: 0.9rem; color: var(--color-text); }
.guide-source__ext { color: var(--color-text-muted); font-size: 0.9rem; }

/* ── Relacionados ──────────────────────────────────────────────────── */
.guide-related { margin-top: var(--space-xl, 48px); }
.guide-related__title { font-size: 1.1rem; font-weight: 700; margin: 0 0 var(--space-md); }

/* ── Paginación ────────────────────────────────────────────────────── */
.guide-pager {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);
  margin-top: var(--space-xl, 48px); padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}
.guide-pager__btn {
  display: flex; flex-direction: column; gap: 6px;
  padding: var(--space-md);
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); text-decoration: none; color: inherit;
  transition: border-color 0.15s;
}
.guide-pager__btn:hover { border-color: var(--color-primary, #3b82f6); }
.guide-pager__btn--next { text-align: right; }
.guide-pager__dir { font-size: 0.78rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.guide-pager__label { font-size: 0.95rem; font-weight: 600; color: var(--color-text); }

/* ── 404 ───────────────────────────────────────────────────────────── */
.guide-404 {
  padding: var(--space-xl, 48px); text-align: center;
  background: var(--color-surface); border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}
.guide-404 h1 { margin-bottom: 8px; }
.guide-404__link { color: var(--color-primary, #3b82f6); text-decoration: none; font-weight: 600; }

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .guide-view { grid-template-columns: 1fr; padding: var(--space-md); }
  .guide-toggle { display: block; }
  .guide-sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    width: 85%; max-width: 320px;
    transform: translateX(-100%); transition: transform 0.2s;
    border-radius: 0; max-height: 100vh;
  }
  .guide-sidebar--open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.2); }
  .guide-sidebar__close { display: block; }
  .guide-pager { grid-template-columns: 1fr; }
}
</style>
