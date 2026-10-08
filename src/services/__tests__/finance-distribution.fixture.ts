import type { DistributionMember, DistributionSimulation } from '@/types/finance-distribution.types'

export const ALBERTO_ID = '0190aaaa-0000-7000-8000-000000000001'
export const ADID_ID = '0190aaaa-0000-7000-8000-000000000002'

export const memberFixture = (over: Partial<DistributionMember> = {}): DistributionMember => ({
  memberId: ALBERTO_ID,
  name: 'Alberto',
  role: 'socio',
  isActive: true,
  partnerEligible: true,
  partnerAmountMinor: 150000,
  workUnits: 2,
  shiftCount: 2,
  knownMinutes: 480,
  unknownDurationCount: 0,
  workAmountMinor: 120000,
  totalMinor: 270000,
  ...over,
})

/**
 * Backend worked example: 600000 minor, 50/50, WORK_SHIFTS; Alberto has 2
 * shifts and Adid 3, both active socios -> 270000 / 330000.
 */
export const simulationFixture = (over: Partial<DistributionSimulation> = {}): DistributionSimulation => ({
  period: {
    from: '2026-10-01',
    to: '2026-11-01',
    fromInstant: '2026-10-01T06:00:00.000Z',
    toInstant: '2026-11-01T06:00:00.000Z',
    utcOffsetMinutes: -360,
    interval: '[from,to)',
  },
  simulation: true,
  persisted: false,
  currency: 'MXN',
  financialBase: {
    potentiallyAvailableMinor: 800000,
    requestedAmountMinor: 600000,
    remainingAvailableMinor: 200000,
    status: 'complete',
  },
  rule: { partnerShareBps: 5000, workShareBps: 5000, workBasis: 'WORK_SHIFTS', partnerMode: 'EQUAL' },
  pools: { partnerPoolMinor: 300000, workPoolMinor: 300000 },
  members: [
    memberFixture(),
    memberFixture({
      memberId: ADID_ID,
      name: 'Adid',
      workUnits: 3,
      shiftCount: 3,
      knownMinutes: 720,
      workAmountMinor: 180000,
      totalMinor: 330000,
    }),
  ],
  totals: { distributedMinor: 600000, undistributedMinor: 0 },
  warnings: [
    { code: 'SIMULATION_ONLY', message: 'This is a simulation.' },
    { code: 'NOT_A_PAYMENT_OR_OBLIGATION', message: 'Simulated amounts are not payments.' },
    { code: 'PARTNER_ELIGIBILITY_IS_CURRENT_STATE', message: 'Partner eligibility uses the current active socios.' },
  ],
  ...over,
})
