import { z } from 'zod'

/**
 * Validates Argentine CUIT format: XX-XXXXXXXX-X
 * Requirement 8.6
 */
export const cuitSchema = z.string().regex(
  /^\d{2}-\d{8}-\d$/,
  'CUIT inválido. Formato esperado: XX-XXXXXXXX-X'
)

/**
 * Valid Argentine tax conditions (condición frente al IVA)
 * RI = Responsable Inscripto
 * MO = Monotributista
 * EX = Exento
 * CF = Consumidor Final
 * RS = Responsable Sustituto
 */
const TAX_CONDITIONS = ['RI', 'MO', 'EX', 'CF', 'RS']

/**
 * Schema for creating a new client.
 * Requirements: 8.4, 8.6
 */
export const clientSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  cuit: cuitSchema.optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_condition: z.enum(TAX_CONDITIONS, {
    errorMap: () => ({ message: 'Condición impositiva inválida. Valores permitidos: RI, MO, EX, CF, RS' }),
  }).optional(),
  notes: z.string().optional(),
})

/**
 * Schema for updating an existing client (PATCH).
 * All fields are optional.
 * Requirements: 8.4, 8.6
 */
export const clientUpdateSchema = clientSchema.partial()
