import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ComentarioService } from '#services/comentario_service'
import ComentarioTransformer from '#transformers/comentario_transformer'
import ComentarioBorradoTransformer from '#transformers/comentario_borrado_transformer'
import {
  crearComentarioValidator,
  credencialesComentarioValidator,
  editarComentarioValidator,
} from '#validators/comentario'

/**
 * El orden de las llamadas reproduce el orden de comprobación del código anterior y
 * está fijado por los tests: el 404 va antes que la validación, y en PATCH la
 * autorización va antes que la validación del cuerpo.
 */
@inject()
export default class ComentariosController {
  constructor(private servicio: ComentarioService) {}

  async store({ params, request, response, serialize }: HttpContext) {
    const post = await this.servicio.postComentable(params.slug)
    const datos = await request.validateUsing(crearComentarioValidator)
    const comentario = await this.servicio.crear(post, datos)

    response.status(201)
    return serialize.withoutWrapping({ comentario: ComentarioTransformer.transform(comentario) })
  }

  async update({ params, request, serialize }: HttpContext) {
    const credenciales = await request.validateUsing(credencialesComentarioValidator)
    const comentario = await this.servicio.autorizarEdicion(params.id, credenciales)
    const { cuerpo } = await request.validateUsing(editarComentarioValidator)
    const editado = await this.servicio.editar(comentario, cuerpo)

    return serialize.withoutWrapping({ comentario: ComentarioTransformer.transform(editado) })
  }

  async destroy({ params, request, serialize }: HttpContext) {
    const credenciales = await request.validateUsing(credencialesComentarioValidator)
    const borrado = await this.servicio.eliminar(params.id, credenciales)

    return serialize.withoutWrapping(ComentarioBorradoTransformer.transform(borrado))
  }
}
