/** How the work component is weighed. The two bases are never mixed. */
export type DistributionWorkBasis = 'WORK_SHIFTS' | 'KNOWN_MINUTES'

export type DistributionMemberRole = 'socio' | 'colaborador'

/** Body of POST /finance/distribution-simulations. `to` is EXCLUSIVE. */
export interface DistributionSimulationRequest {
  from: string
  to: string
  requestedAmountMinor: number
  partnerShareBps: number
  workShareBps: number
  workBasis: DistributionWorkBasis
}

export interface DistributionMember {
  memberId: string
  name: string
  role: DistributionMemberRole
  isActive: boolean
  partnerEligible: boolean
  partnerAmountMinor: number
  /** Weight in the chosen basis (shifts or known minutes). */
  workUnits: number
  shiftCount: number
  knownMinutes: number
  unknownDurationCount: number
  workAmountMinor: number
  totalMinor: number
}

export interface DistributionWarning {
  code: string
  message: string
}

export interface DistributionSimulation {
  simulationFingerprint: string
  period: {
    from: string
    to: string
    fromInstant: string
    toInstant: string
    utcOffsetMinutes: number
    interval: string
  }
  simulation: true
  persisted: false
  currency: 'MXN'
  financialBase: {
    potentiallyAvailableMinor: number
    requestedAmountMinor: number
    remainingAvailableMinor: number
    status: 'complete' | 'partial'
  }
  rule: {
    partnerShareBps: number
    workShareBps: number
    workBasis: DistributionWorkBasis
    partnerMode: 'EQUAL'
  }
  pools: { partnerPoolMinor: number; workPoolMinor: number }
  members: DistributionMember[]
  totals: { distributedMinor: number; undistributedMinor: number }
  warnings: DistributionWarning[]
}
