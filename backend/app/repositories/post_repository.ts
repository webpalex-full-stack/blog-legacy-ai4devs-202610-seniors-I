import Post from '#models/post'

/**
 * Acceso a datos de posts que necesitan los comentarios.
 */
export default class PostRepository {
  /** El post publicado con ese slug, o null. Si hay varios, el primero que dé SQLite. */
  buscarPublicadoPorSlug(slug: string) {
    return Post.query().where('slug', slug).where('estado', 'publicado').first()
  }
}
