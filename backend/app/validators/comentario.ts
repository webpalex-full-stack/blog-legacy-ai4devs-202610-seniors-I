import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'
import type { ErrorReporterContract } from '@vinejs/vine/types'
import type { ValidationError } from '@vinejs/vine'
import EntradaInvalidaException from '#exceptions/entrada_invalida_exception'

/**
 * Validadores de los endpoints de comentarios.
 *
 * Reproducen el contrato HEREDADO de las rutas legacy, bugs incluidos (ver
 * docs/auditoria/comentarios.md, hallazgos 10 y 11):
 *  - Cada campo responde con su propio código y su propio cuerpo de error.
 *  - Los campos no se tipan: se comprueba si el valor es «verdadero» y se convierte con
 *    String(), igual que hacía el código anterior. Tiparlos es un cambio de contrato.
 */

/* -------------------------------------------------------------------------
 * Reglas
 * ---------------------------------------------------------------------- */

/** El valor es «verdadero» en JavaScript (rechaza '', 0, false, null…). */
const presente = vine.createRule((valor: unknown, _opciones: undefined, campo: FieldContext) => {
  if (!valor) campo.report('El campo {{ field }} es obligatorio', 'presente', campo)
})

/** String(valor) contiene una arroba. */
const contieneArroba = vine.createRule(
  (valor: unknown, _opciones: undefined, campo: FieldContext) => {
    if (String(valor).indexOf('@') === -1) {
      campo.report('El campo {{ field }} no es un correo', 'contieneArroba', campo)
    }
  }
)

/** El valor es «verdadero» y String(valor) tiene al menos `min` caracteres. */
const longitudMinima = vine.createRule(
  (valor: unknown, { min }: { min: number }, campo: FieldContext) => {
    if (!valor || String(valor).length < min) {
      campo.report('El campo {{ field }} es demasiado corto', 'longitudMinima', campo)
    }
  }
)

/* -------------------------------------------------------------------------
 * Contrato de errores heredado
 * ---------------------------------------------------------------------- */

type RespuestaDeError = { status: number; cuerpo: Record<string, unknown> }

/**
 * Para cada campo, la respuesta por regla. `*` es la respuesta de cualquier otra regla
 * del campo (incluida `required`, que salta cuando el campo no llega).
 */
type ContratoDeErrores = Record<string, Record<string, RespuestaDeError>>

/**
 * Se queda con el PRIMER error reportado, que es el del primer campo del esquema que
 * falla: así se respeta el orden de comprobación del código anterior.
 */
class ReporterConContrato implements ErrorReporterContract {
  hasErrors = false
  #primero?: { campo: string; regla: string }

  constructor(private contrato: ContratoDeErrores) {}

  report(_mensaje: string, regla: string, campo: FieldContext) {
    this.hasErrors = true
    this.#primero ??= { campo: campo.wildCardPath, regla }
  }

  createError(): ValidationError {
    const { campo, regla } = this.#primero!
    const reglas = this.contrato[campo]
    const respuesta = reglas?.[regla] ?? reglas?.['*']
    if (!respuesta) {
      throw new Error(`Sin contrato de error para ${campo}.${regla}`)
    }
    // El contrato de VineJS pide un ValidationError, pero aquí el contrato heredado
    // exige otra forma de respuesta: la pinta app/exceptions/handler.ts.
    return new EntradaInvalidaException(
      respuesta.status,
      respuesta.cuerpo
    ) as unknown as ValidationError
  }
}

function conContrato(contrato: ContratoDeErrores) {
  return () => new ReporterConContrato(contrato)
}

/* -------------------------------------------------------------------------
 * POST /posts/:slug/comentarios
 * ---------------------------------------------------------------------- */
export const crearComentarioValidator = vine.create({
  autor_nombre: vine.any().use(presente()),
  autor_email: vine.any().use(presente()).use(contieneArroba()),
  cuerpo: vine.any().use(longitudMinima({ min: 5 })),
  padre_id: vine.any().nullable().optional(),
})

crearComentarioValidator.errorReporter = conContrato({
  autor_nombre: { '*': { status: 400, cuerpo: { error: 'El nombre es obligatorio' } } },
  autor_email: {
    'contieneArroba': { status: 400, cuerpo: { errores: ['email no válido'] } },
    '*': { status: 422, cuerpo: { message: 'Falta el email' } },
  },
  cuerpo: { '*': { status: 200, cuerpo: { ok: false, motivo: 'comentario demasiado corto' } } },
})

/* -------------------------------------------------------------------------
 * DELETE /comentarios/:id y PATCH /comentarios/:id — quién llama
 *
 * No rechaza nada: solo da forma a las credenciales. Decidir si bastan es una regla de
 * negocio y vive en el servicio.
 * ---------------------------------------------------------------------- */
export const credencialesComentarioValidator = vine.create({
  autor_email: vine.any().nullable().optional(),
  headers: vine.object({
    'x-clave-moderacion': vine.any().optional(),
  }),
})

/* -------------------------------------------------------------------------
 * PATCH /comentarios/:id — nuevo cuerpo
 * ---------------------------------------------------------------------- */
export const editarComentarioValidator = vine.create({
  cuerpo: vine.any().use(presente()),
})

editarComentarioValidator.errorReporter = conContrato({
  cuerpo: { '*': { status: 400, cuerpo: { error: 'Falta el cuerpo' } } },
})
