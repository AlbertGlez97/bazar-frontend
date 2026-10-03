import { openLocalDb } from './local-db'
import { financeScope } from './contributions-records'
import type {
  FinancialOperation,
  FinanceOrigin,
  PendingContribution,
  FinanceReferences,
} from './contributions-records'
import type { Contribution, ReversalReceipt } from '@/types/contribution.types'
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const key = (scope: string, id: string) => JSON.stringify([scope, id])
export async function financeSnapshot(origin: FinanceOrigin) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  const tx = db.transaction(
    ['pending-contributions', 'contribution-history', 'finance-references'],
    'readonly',
  )
  const [pending, history, references] = await Promise.all([
    tx.objectStore('pending-contributions').getAll(),
    tx.objectStore('contribution-history').getAll(),
    tx.objectStore('finance-references').get(scope),
  ])
  await tx.done
  return {
    pending: pending
      .filter((r) => r.scope === scope)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    history: history
      .filter((r) => r.scope === scope)
      .map((r) => r.contribution),
    references,
  }
}
export async function enqueueContribution(
  origin: FinanceOrigin,
  operation: FinancialOperation,
) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  if (
    operation.payload.createdByMemberId !== origin.memberId ||
    operation.payload.deviceId !== origin.deviceId
  )
    throw new Error('Financial operation origin mismatch')
  const tx = db.transaction(
    ['pending-contributions', 'contribution-history'],
    'readwrite',
  )
  const pendingStore = tx.objectStore('pending-contributions')
  const existing = await pendingStore.get(key(scope, operation.payload.id))
  if (existing) {
    await tx.done
    if (
      existing.kind !== operation.kind ||
      existing.origin.memberId !== origin.memberId ||
      existing.origin.deviceId !== origin.deviceId ||
      (existing.kind === 'reverse' &&
        operation.kind === 'reverse' &&
        existing.contributionId !== operation.contributionId) ||
      JSON.stringify(existing.payload) !==
        JSON.stringify(plain(operation.payload))
    )
      throw new Error('Operation identity already exists')
    return existing
  }
  if (operation.kind === 'reverse') {
    const pending = (await pendingStore.getAll()).filter(
      (r) => r.scope === scope,
    )
    const original = await tx
      .objectStore('contribution-history')
      .get(key(scope, operation.contributionId))
    if (
      original?.contribution.reversal ||
      pending.some(
        (r) =>
          r.kind === 'reverse' && r.contributionId === operation.contributionId,
      )
    ) {
      await tx.done
      throw new Error('Contribution already has a correction')
    }
    if (
      !original &&
      !pending.some(
        (r) => r.kind === 'create' && r.id === operation.contributionId,
      )
    ) {
      await tx.done
      throw new Error(
        'Contribution must be available locally before correction',
      )
    }
  } else if (
    await tx
      .objectStore('contribution-history')
      .get(key(scope, operation.payload.id))
  ) {
    await tx.done
    throw new Error('Contribution identity already confirmed')
  }
  const record: PendingContribution = plain({
    ...operation,
    origin,
    scope,
    id: operation.payload.id,
    key: key(scope, operation.payload.id),
    createdAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  })
  await pendingStore.add(record)
  await tx.done
  return record
}
export async function updateContributionAttempt(
  record: PendingContribution,
  state: PendingContribution['state'],
  lastError: string,
  now = Date.now(),
) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-contributions', 'readwrite')
  const current = await tx.store.get(record.key)
  if (current)
    await tx.store.put({
      ...current,
      state,
      lastError,
      attempts: current.attempts + 1,
      nextAttemptAt:
        now + Math.min(300000, 30000 * 2 ** Math.min(current.attempts, 4)),
    })
  await tx.done
}
export async function retryContribution(record: PendingContribution) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-contributions', 'readwrite')
  const current = await tx.store.get(record.key)
  if (current)
    await tx.store.put({
      ...current,
      state: 'pending',
      nextAttemptAt: 0,
      lastError: undefined,
    })
  await tx.done
}
export async function confirmContribution(
  record: PendingContribution,
  receipt: Contribution | ReversalReceipt,
) {
  const db = await openLocalDb(),
    tx = db.transaction(
      ['pending-contributions', 'contribution-history'],
      'readwrite',
    )
  const store = tx.objectStore('contribution-history')
  const put = async (contribution: Contribution) => {
    const id = key(record.scope, contribution.id),
      previous = await store.get(id)
    const existing = previous?.contribution
    await store.put(
      plain({
        key: id,
        scope: record.scope,
        contribution: {
          ...existing,
          ...contribution,
          member: contribution.member ?? existing?.member,
          reversal: contribution.reversal ?? existing?.reversal ?? null,
        },
      }),
    )
  }
  if (record.kind === 'create') await put(receipt as Contribution)
  else {
    const reversal = receipt as ReversalReceipt
    const { original, replacement, ...metadata } = reversal
    await put({ ...original, reversal: metadata })
    if (replacement) await put(replacement)
  }
  await tx.objectStore('pending-contributions').delete(record.key)
  await tx.done
}
export async function mergeContributionHistory(
  origin: FinanceOrigin,
  contributions: Contribution[],
) {
  const db = await openLocalDb(),
    scope = financeScope(origin),
    tx = db.transaction('contribution-history', 'readwrite')
  for (const contribution of contributions) {
    const id = key(scope, contribution.id),
      previous = await tx.store.get(id)
    await tx.store.put(
      plain({
        key: id,
        scope,
        contribution: {
          ...previous?.contribution,
          ...contribution,
          reversal:
            contribution.reversal ?? previous?.contribution.reversal ?? null,
        },
      }),
    )
  }
  await tx.done
}
export async function saveFinanceReferences(
  origin: FinanceOrigin,
  references: Omit<FinanceReferences, 'scope'>,
) {
  const db = await openLocalDb()
  await db.put(
    'finance-references',
    plain({ ...references, scope: financeScope(origin) }),
  )
}
