<template>
  <!-- Overlay que bloquea la app hasta que la DEK sea restaurada en RAM -->
  <Teleport to="body">
    <div class="krm-overlay" role="dialog" aria-modal="true" aria-labelledby="krm-title">
      <div class="krm-card">

        <div class="krm-icon">🔐</div>
        <h2 id="krm-title" class="krm-title">Sesión cifrada activa</h2>
        <p class="krm-desc">
          Tu sesión financiera está protegida con cifrado de extremo a extremo.
          Ingresá tu contraseña para descifrar tus datos en este dispositivo.
        </p>

        <form class="krm-form" @submit.prevent="handleRestore">
          <div class="krm-field">
            <label class="krm-label" for="krm-password">Contraseña</label>
            <input
              id="krm-password"
              ref="inputRef"
              v-model="password"
              type="password"
              class="krm-input"
              placeholder="Tu contraseña de acceso"
              autocomplete="current-password"
              :disabled="cryptoStore.isLoading"
              @keyup.enter="handleRestore"
            />
          </div>

          <p v-if="cryptoStore.error" class="krm-error">
            {{ cryptoStore.error }}
          </p>

          <button
            type="submit"
            class="krm-btn"
            :disabled="!password || cryptoStore.isLoading"
          >
            <span v-if="cryptoStore.isLoading" class="krm-spinner"></span>
            <span v-else>Desbloquear</span>
          </button>
        </form>

        <button class="krm-logout" @click="handleLogout">
          Cerrar sesión
        </button>

        <p class="krm-note">
          🔒 Tus datos financieros son ilegibles sin tu contraseña.
          El servidor nunca almacena montos en texto plano.
        </p>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCryptoStore } from '@/stores/crypto.store'
import { useAuthStore } from '@/stores/auth.store'

const cryptoStore = useCryptoStore()
const authStore   = useAuthStore()

const password = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  // Focus automático en el campo de contraseña
  inputRef.value?.focus()
})

async function handleRestore() {
  if (!password.value || !authStore.user) return
  try {
    await cryptoStore.restoreSession(password.value, authStore.user.id)
    // isReady = true → el watcher en App.vue oculta el modal automáticamente
  } catch {
    // El error ya está en cryptoStore.error — mostrado en el template
    password.value = ''
    inputRef.value?.focus()
  }
}

function handleLogout() {
  authStore.logout()
}
</script>

<style scoped>
.krm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(8, 13, 23, 0.92);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.krm-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  padding: 40px 32px;
  max-width: 400px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.krm-icon {
  font-size: 48px;
  line-height: 1;
}

.krm-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin: 0;
}

.krm-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.krm-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.krm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.krm-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.krm-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.krm-input:focus {
  border-color: var(--color-primary);
}

.krm-error {
  font-size: 0.8rem;
  color: var(--color-danger);
  text-align: center;
  margin: 0;
}

.krm-btn {
  width: 100%;
  padding: 11px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s;
}
.krm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.krm-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.krm-logout {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.krm-logout:hover { color: var(--color-danger); }

.krm-note {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.4;
  margin: 0;
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
  width: 100%;
}
</style>
