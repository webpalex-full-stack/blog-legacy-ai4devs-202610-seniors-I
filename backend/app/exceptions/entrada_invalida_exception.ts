import { Exception } from '@adonisjs/core/exceptions'

/**
 * La entrada no supera un validador cuyo contrato de error es heredado: cada regla
 * responde con su propio código de estado y su propio cuerpo. La lanza el reporter
 * de app/validators/comentario.ts y la pinta app/exceptions/handler.ts tal cual.
 */
export default class EntradaInvalidaException extends Exception {
  static code = 'E_ENTRADA_INVALIDA'

  constructor(
    status: number,
    readonly cuerpo: Record<string, unknown>
  ) {
    super('Entrada inválida', { status })
  }
}
