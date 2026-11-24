import { BaseTransformer } from '@adonisjs/core/transformers'
import type Comentario from '#models/comentario'

/**
 * Forma pública de un comentario en las respuestas de POST y PATCH.
 *
 * Reproduce la fila que devolvía el código anterior: claves en snake_case y
 * `creado_en` como 'yyyy-MM-dd HH:mm:ss'.
 *
 * BUG CARACTERIZADO (hallazgos 1 y 4 de docs/auditoria/comentarios.md): incluye
 * `autor_email` y `estado`. Quitarlos es un cambio de contrato y va en otra tarea.
 */
export default class ComentarioTransformer extends BaseTransformer<Comentario> {
  toObject() {
    const comentario = this.resource
    return {
      id: comentario.id,
      post_id: comentario.postId,
      autor_nombre: comentario.autorNombre,
      autor_email: comentario.autorEmail,
      cuerpo: comentario.cuerpo,
      estado: comentario.estado,
      creado_en: comentario.creadoEn ? comentario.creadoEn.toFormat('yyyy-MM-dd HH:mm:ss') : null,
      padre_id: comentario.padreId,
    }
  }
}
