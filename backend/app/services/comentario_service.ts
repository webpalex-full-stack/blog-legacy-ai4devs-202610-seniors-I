import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type Comentario from '#models/comentario'
import type Post from '#models/post'
import PostRepository from '#repositories/post_repository'
import ComentarioRepository from '#repositories/comentario_repository'
import AccionProhibidaException from '#exceptions/accion_prohibida_exception'
import RecursoNoEncontradoException from '#exceptions/recurso_no_encontrado_exception'

/**
 * Clave de moderación.
 *
 * BUG CARACTERIZADO (hallazgo 3 de docs/auditoria/comentarios.md): está escrita en el
 * código. Se ha movido aquí desde start/routes.ts sin cambiar su valor; sacarla a una
 * variable de entorno es otra tarea.
 */
const CLAVE_MODERACION = 'dev-secret-cambiar'

/** Salida de crearComentarioValidator: los campos no se tipan (contrato heredado). */
export type NuevoComentario = {
  autor_nombre?: unknown
  autor_email?: unknown
  cuerpo?: unknown
  padre_id?: unknown
}

export type Credenciales = {
  autor_email?: unknown
  headers: { 'x-clave-moderacion'?: unknown }
}

/** `request.input('autor_email', '')`: el valor por defecto solo aplica si no llega. */
function correoDe(credenciales: Credenciales) {
  return credenciales.autor_email === undefined ? '' : credenciales.autor_email
}

/**
 * Reglas de negocio de los comentarios. Es el único sitio que muta comentarios.
 */
@inject()
export class ComentarioService {
  constructor(
    private comentarios: ComentarioRepository,
    private posts: PostRepository
  ) {}

  /** Un comentario solo se puede dejar en un post publicado. */
  async postComentable(slug: string): Promise<Post> {
    const post = await this.posts.buscarPublicadoPorSlug(slug)
    if (!post) throw new RecursoNoEncontradoException('Post no encontrado')
    return post
  }

  /** Todo comentario nuevo nace pendiente de moderación. */
  async crear(post: Post, datos: NuevoComentario): Promise<Comentario> {
    await this.comentarios.crear({
      postId: post.id,
      autorNombre: datos.autor_nombre,
      autorEmail: datos.autor_email,
      cuerpo: datos.cuerpo,
      estado: 'pendiente',
      creadoEn: DateTime.utc(),
      padreId: datos.padre_id ?? null,
    })
    return this.comentarios.ultimoDeLaTabla()
  }

  /**
   * Puede borrar quien traiga la clave de moderación o el mismo correo con el que se
   * escribió el comentario, sin distinguir mayúsculas ni espacios.
   *
   * BUG CARACTERIZADO (hallazgo 2): el correo no es una credencial; quien lo conozca
   * puede borrar el comentario.
   */
  async eliminar(id: unknown, credenciales: Credenciales): Promise<Comentario> {
    const comentario = await this.existente(id)

    const esModerador = credenciales.headers['x-clave-moderacion'] === CLAVE_MODERACION
    const esAutor =
      String(comentario.autorEmail).toLowerCase().trim() ===
      String(correoDe(credenciales)).toLowerCase().trim()

    if (!esModerador && !esAutor) {
      throw new AccionProhibidaException('No puedes borrar este comentario')
    }
    await this.comentarios.eliminar(comentario)
    return comentario
  }

  /**
   * Puede editar quien traiga exactamente el mismo correo, y solo mientras el
   * comentario siga pendiente.
   *
   * BUG CARACTERIZADO (hallazgo 9): esta regla no coincide con la de borrar (distingue
   * mayúsculas y no admite la clave de moderación).
   */
  async autorizarEdicion(id: unknown, credenciales: Credenciales): Promise<Comentario> {
    const comentario = await this.existente(id)
    if (comentario.autorEmail !== correoDe(credenciales) || comentario.estado !== 'pendiente') {
      throw new AccionProhibidaException('No puedes editar este comentario')
    }
    return comentario
  }

  async editar(comentario: Comentario, cuerpo: unknown): Promise<Comentario> {
    return this.comentarios.actualizarCuerpo(comentario, cuerpo)
  }

  private async existente(id: unknown): Promise<Comentario> {
    const comentario = await this.comentarios.buscarPorId(id)
    if (!comentario) throw new RecursoNoEncontradoException('Comentario no encontrado')
    return comentario
  }
}
