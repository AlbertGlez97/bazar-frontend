import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AccountInvitationsService } from '@/services/account-invitations.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { invitationErrorMessage } from '@/utils/account-invitations'
import { useAuthStore } from './auth.store'
import { useSessionStore } from './session.store'
import type { FinanceOrigin } from '@/services/contributions-records'
import type { InvitationStatus } from '@/types/account-invitation.types'

const ACCESS_MESSAGE = 'Confirma la sesión, la persona socia y el dispositivo antes de continuar.'
const OFFLINE_MESSAGE = 'Necesitas conexión para invitar o ver las invitaciones.'

/** Online-only and memory-only: the server owns invitations; this store mirrors what it answers. */
export const useAccountInvitationsStore = defineStore('account-invitations', () => {
  const auth = useAuthStore()
  const session = useSessionStore()
  const items = ref<InvitationStatus[]>([])
  const loading = ref(false)
  const error = ref('')
  const working = ref(false)
  const actionError = ref('')
  const sentTo = ref('')
  let revision = 0

  function origin(): FinanceOrigin | null {
    if (!auth.token || session.member?.role !== 'socio' || session.member.active !== true) return null
    const current = currentQueueOrigin()
    return current ? { ...current } : null
  }
  const online = () => navigator.onLine
  const byMember = (memberId: string) => items.value.find((i) => i.memberId === memberId)

  async function load(): Promise<void> {
    const mine = ++revision
    const selected = origin()
    error.value = ''
    if (!selected || !online()) {
      error.value = selected ? OFFLINE_MESSAGE : ACCESS_MESSAGE
      return
    }
    loading.value = true
    try {
      const data = await AccountInvitationsService.status(selected)
      if (mine === revision) items.value = data
    } catch (cause) {
      if (mine === revision) error.value = invitationErrorMessage(cause)
    } finally {
      if (mine === revision) loading.value = false
    }
  }

  /** Sends (or re-sends) the invitation. True only when the server accepted it. */
  async function invite(memberId: string, email: string): Promise<boolean> {
    const selected = origin()
    actionError.value = ''
    sentTo.value = ''
    if (!selected || !online()) {
      actionError.value = selected ? OFFLINE_MESSAGE : ACCESS_MESSAGE
      return false
    }
    working.value = true
    try {
      await AccountInvitationsService.invite(selected, memberId, email)
      sentTo.value = email
      await load()
      return true
    } catch (cause) {
      actionError.value = invitationErrorMessage(cause)
      await load()
      return false
    } finally {
      working.value = false
    }
  }

  function reset() {
    revision++
    items.value = []
    error.value = ''
    actionError.value = ''
    sentTo.value = ''
    loading.value = false
    working.value = false
  }

  return { items, loading, error, working, actionError, sentTo, byMember, load, invite, reset }
})
