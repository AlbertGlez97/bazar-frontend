import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

/** The shape every public page of an emailed link shares. The token must be 32 bytes in base64url. */
export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

/**
 * Behavior shared by the public pages that an emailed single-use link opens:
 * - the page address carries the token, so no page it leads to may receive it in the Referer header;
 * - each new state is announced by moving the focus to the title (not while it is still working).
 */
export function useLinkPage(state: Ref<string>, title: Ref<HTMLElement | null>, onReady: () => void) {
  let referrerMeta: HTMLMetaElement | null = null
  onMounted(() => {
    referrerMeta = document.createElement('meta')
    referrerMeta.name = 'referrer'
    referrerMeta.content = 'no-referrer'
    document.head.appendChild(referrerMeta)
    onReady()
  })
  onBeforeUnmount(() => referrerMeta?.remove())

  watch(state, async (now) => {
    if (now === 'working' || now === 'loading') return
    await nextTick()
    title.value?.focus()
  })
}
