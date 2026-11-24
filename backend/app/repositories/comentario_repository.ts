import { type DateTime } from 'luxon'
import Comentario from '#models/comentario'

export type DatosNuevoComentario = {
  postId: number
  autorNombre: unknown
  autorEmail: unknown
  cuerpo: unknown
  estado: string
  creadoEn: DateTime
  padreId: unknown
}

/**
 * Todo el acceso a datos de comentarios.
 *
 * Los valores de entrada llegan sin tipar (`unknown`) porque el contrato heredado no
 * tipa los campos: se guardan tal cual, como hacía el código anterior.
 */
export default class ComentarioRepository {
  buscarPorId(id: unknown) {
    return Comentario.find(id)
  }

  async crear(datos: DatosNuevoComentario) {
    await Comentario.create(datos as Partial<Comentario>)
  }

  /**
   * El último comentario de TODA la tabla.
   *
   * BUG CARACTERIZADO (hallazgo 4 de docs/auditoria/comentarios.md): no está ligado al
   * insert, así que con dos envíos simultáneos puede devolver el comentario de otra
   * persona. Se mantiene porque este cambio es un refactor; corregirlo es otra tarea.
   */
  ultimoDeLaTabla() {
    return Comentario.query().orderBy('id', 'desc').firstOrFail()
  }

  async eliminar(comentario: Comentario) {
    await comentario.delete()
  }

  /** Cambia el cuerpo y vuelve a leer la fila, como hacía el código anterior. */
  async actualizarCuerpo(comentario: Comentario, cuerpo: unknown) {
    comentario.merge({ cuerpo } as Partial<Comentario>)
    await comentario.save()
    return Comentario.findOrFail(comentario.id)
  }
}
