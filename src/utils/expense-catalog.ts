import type {
  ExpenseCategory,
  ExpenseNature,
  FundsSource,
  OperatingCategory,
} from '@/types/expense.types'

export const INVENTORY_CATEGORY = 'inventory' as const

export const NATURE_LABELS: Record<ExpenseNature, string> = {
  OPERATING_EXPENSE: 'Gasto operativo',
  INVENTORY_PURCHASE: 'Compra de inventario',
}

export const FUNDS_SOURCE_LABELS: Record<FundsSource, string> = {
  BUSINESS: 'Negocio',
  PERSONAL: 'Personal',
}

export const OPERATING_CATEGORIES: readonly {
  code: OperatingCategory
  label: string
}[] = [
  { code: 'transport', label: 'Transporte' },
  { code: 'fuel', label: 'Gasolina' },
  { code: 'food', label: 'Alimentos' },
  { code: 'bazaar_rent', label: 'Bazar / renta' },
  { code: 'storage', label: 'Almacenamiento' },
  { code: 'advertising', label: 'Publicidad' },
  { code: 'utilities', label: 'Servicios' },
  { code: 'packaging', label: 'Empaque / consumibles' },
  { code: 'maintenance', label: 'Mantenimiento' },
  { code: 'operating_payment', label: 'Pago operativo' },
  { code: 'other', label: 'Otro' },
]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ...(Object.fromEntries(
    OPERATING_CATEGORIES.map((c) => [c.code, c.label]),
  ) as Record<OperatingCategory, string>),
  inventory: 'Inventario',
}

export const isNature = (v: unknown): v is ExpenseNature =>
  v === 'OPERATING_EXPENSE' || v === 'INVENTORY_PURCHASE'
export const isFundsSource = (v: unknown): v is FundsSource =>
  v === 'BUSINESS' || v === 'PERSONAL'
export const isCategory = (v: unknown): v is ExpenseCategory =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, v)

/** An inventory purchase only allows `inventory`; operating expenses exclude it. */
export function categoryMatchesNature(
  nature: ExpenseNature,
  category: ExpenseCategory,
): boolean {
  return nature === 'INVENTORY_PURCHASE'
    ? category === INVENTORY_CATEGORY
    : category !== INVENTORY_CATEGORY
}
