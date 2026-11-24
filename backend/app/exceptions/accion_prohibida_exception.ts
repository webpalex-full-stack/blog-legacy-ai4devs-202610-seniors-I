import { Exception } from '@adonisjs/core/exceptions'

/**
 * Quien llama no tiene permiso para la acción. Se pinta como 403 { error } en
 * app/exceptions/handler.ts.
 */
export default class AccionProhibidaException extends Exception {
  static status = 403
  static code = 'E_ACCION_PROHIBIDA'
}
