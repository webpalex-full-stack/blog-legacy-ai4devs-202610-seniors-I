import { BaseTransformer } from '@adonisjs/core/transformers'
import type Comentario from '#models/comentario'

/**
 * Respuesta de DELETE /comentarios/:id: solo confirma el borrado, sin datos del comentario.
 */
export default class ComentarioBorradoTransformer extends BaseTransformer<Comentario> {
  toObject() {
    return { borrado: true }
  }
}
