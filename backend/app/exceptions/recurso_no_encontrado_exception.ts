import { Exception } from '@adonisjs/core/exceptions'

/**
 * El recurso pedido no existe (o no es visible). Se pinta como 404 { error } en
 * app/exceptions/handler.ts.
 */
export default class RecursoNoEncontradoException extends Exception {
  static status = 404
  static code = 'E_RECURSO_NO_ENCONTRADO'
}
