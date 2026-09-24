export type MsiStatus = 'active' | 'completed' | 'cancelled'

export interface MsiPurchase {
  id:            string
  userId:        string
  name:          string
  store:         string | null
  totalAmount:   number
  installments:  number
  monthlyAmount: number
  startYear:     number
  startMonth:    number
  status:        MsiStatus
  createdAt:     string
}

export interface CreateMsiPayload {
  name:         string
  store?:       string
  totalAmount:  number
  installments: number
  startYear:    number
  startMonth:   number
}
