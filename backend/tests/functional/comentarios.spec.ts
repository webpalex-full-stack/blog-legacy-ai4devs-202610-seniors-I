import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Tests de CARACTERIZACIÓN de los endpoints de comentarios.
 *
 * Fijan lo que el sistema hace HOY, bugs incluidos. Los bugs están marcados con
 * «BUG CARACTERIZADO» y el número del hallazgo en docs/auditoria/comentarios.md
 * (rama feat/auditoria-comentarios). Corregir cualquiera de ellos es otra tarea, con
 * su propia decisión: ese cambio sustituirá el test correspondiente por uno nuevo.
 */

const POST_ID = 9001
const SLUG = 'post-de-prueba'
const CLAVE_MODERACION_ACTUAL = 'dev-secret-cambiar'
const FORMATO_CREADO_EN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const CAMPOS_COMENTARIO = [
  'id',
  'post_id',
  'autor_nombre',
  'autor_email',
  'cuerpo',
  'estado',
  'creado_en',
  'padre_id',
]

function unPost(cambios: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    titulo: 'Post de prueba',
    slug: SLUG,
    resumen: 'Resumen de prueba',
    cuerpo: '## Cuerpo de prueba',
    imagen_portada: null,
    estado: 'publicado',
    publicado_en: '2026-01-01 10:00:00',
    autor_id: 1,
    categoria_id: 1,
    autor_nombre: 'Marta Ruiz Calvo',
    autor_email: 'marta.ruiz@corriente.es',
    categoria_nombre: 'Noticias',
    etiquetas: 'Artículos',
    created_at: '2026-01-01 10:00:00',
    updated_at: '2026-01-01 10:00:00',
    ...cambios,
  }
}

function unComentario(cambios: Record<string, unknown> = {}) {
  return {
    id: 9101,
    post_id: POST_ID,
    autor_nombre: 'Ana Cortés',
    autor_email: 'ana.cortes@ejemplo.es',
    cuerpo: 'Un comentario ya guardado.',
    estado: 'pendiente',
    creado_en: '2026-02-01 09:30:00',
    padre_id: null,
    ...cambios,
  }
}

function comentarioValido(cambios: Record<string, unknown> = {}) {
  return {
    autor_nombre: 'Lucía Ferrer',
    autor_email: 'lucia.ferrer@ejemplo.es',
    cuerpo: 'Un comentario suficientemente largo.',
    ...cambios,
  }
}

async function contarComentarios() {
  const [fila] = await db.from('comentarios').count('* as total')
  return Number(fila.total)
}

async function buscarComentario(id: number) {
  return db.from('comentarios').where('id', id).first()
}

/* -------------------------------------------------------------------------
 * POST /posts/:slug/comentarios
 * ---------------------------------------------------------------------- */
test.group('POST /posts/:slug/comentarios', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('crea un comentario pendiente y devuelve la fila completa con 201', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client.post(`/posts/${SLUG}/comentarios`).json(comentarioValido())

    // Assert
    respuesta.assertStatus(201)
    const cuerpo = respuesta.body()
    assert.sameMembers(Object.keys(cuerpo), ['comentario'])
    const comentario = cuerpo.comentario
    assert.sameMembers(Object.keys(comentario), CAMPOS_COMENTARIO)
    assert.isNumber(comentario.id)
    assert.strictEqual(comentario.post_id, POST_ID)
    assert.strictEqual(comentario.autor_nombre, 'Lucía Ferrer')
    assert.strictEqual(comentario.cuerpo, 'Un comentario suficientemente largo.')
    assert.strictEqual(comentario.estado, 'pendiente')
    assert.isString(comentario.creado_en)
    assert.match(comentario.creado_en, FORMATO_CREADO_EN)
    assert.isNull(comentario.padre_id)
    // BUG CARACTERIZADO (hallazgo 4): la respuesta devuelve el correo de quien comenta.
    assert.strictEqual(comentario.autor_email, 'lucia.ferrer@ejemplo.es')

    const guardado = await buscarComentario(comentario.id)
    assert.strictEqual(guardado.estado, 'pendiente')
    assert.strictEqual(guardado.post_id, POST_ID)
  })

  test('guarda creado_en como la hora UTC del momento del envío', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // Act
    const respuesta = await client.post(`/posts/${SLUG}/comentarios`).json(comentarioValido())

    // Assert
    const despues = new Date().toISOString().slice(0, 19).replace('T', ' ')
    respuesta.assertStatus(201)
    const creadoEn = respuesta.body().comentario.creado_en
    assert.isTrue(
      creadoEn >= antes && creadoEn <= despues,
      `${creadoEn} fuera de [${antes}, ${despues}]`
    )
  })

  test('guarda el padre_id que recibe', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario({ estado: 'aprobado' }))

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ padre_id: 9101 }))

    // Assert
    respuesta.assertStatus(201)
    assert.strictEqual(respuesta.body().comentario.padre_id, 9101)
  })

  test('BUG CARACTERIZADO (hallazgo 8): acepta un padre_id que no existe', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ padre_id: 999999 }))

    // Assert
    respuesta.assertStatus(201)
    assert.strictEqual(respuesta.body().comentario.padre_id, 999999)
  })

  test('acepta un cuerpo de exactamente 5 caracteres (frontera)', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ cuerpo: 'cinco' }))

    // Assert
    respuesta.assertStatus(201)
    assert.strictEqual(respuesta.body().comentario.cuerpo, 'cinco')
  })

  test('devuelve 404 si el post no existe y no guarda nada', async ({ client, assert }) => {
    // Arrange
    const antes = await contarComentarios()

    // Act
    const respuesta = await client.post('/posts/no-existe/comentarios').json(comentarioValido())

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Post no encontrado' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('devuelve 404 si el post es un borrador', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost({ estado: 'borrador' }))
    const antes = await contarComentarios()

    // Act
    const respuesta = await client.post(`/posts/${SLUG}/comentarios`).json(comentarioValido())

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Post no encontrado' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('el 404 del post va antes que la validación de la entrada', async ({ client }) => {
    // Act
    const respuesta = await client.post('/posts/no-existe/comentarios').json({})

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Post no encontrado' })
  })

  test('sin nombre devuelve 400 {error}', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = await contarComentarios()

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ autor_nombre: undefined }))

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ error: 'El nombre es obligatorio' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('con el nombre vacío devuelve 400 {error}', async ({ client }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ autor_nombre: '' }))

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ error: 'El nombre es obligatorio' })
  })

  test('BUG CARACTERIZADO (hallazgo 11): sin correo devuelve 422 {message}', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = await contarComentarios()

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ autor_email: undefined }))

    // Assert
    respuesta.assertStatus(422)
    respuesta.assertBody({ message: 'Falta el email' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('BUG CARACTERIZADO (hallazgo 11): un correo sin @ devuelve 400 {errores}', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = await contarComentarios()

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ autor_email: 'sin-arroba.es' }))

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ errores: ['email no válido'] })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('BUG CARACTERIZADO (hallazgo 11): un cuerpo de 4 caracteres devuelve 200 {ok:false}', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = await contarComentarios()

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ cuerpo: 'cuat' }))

    // Assert
    respuesta.assertStatus(200)
    respuesta.assertBody({ ok: false, motivo: 'comentario demasiado corto' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('sin cuerpo devuelve 200 {ok:false}', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    const antes = await contarComentarios()

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json(comentarioValido({ cuerpo: undefined }))

    // Assert
    respuesta.assertStatus(200)
    respuesta.assertBody({ ok: false, motivo: 'comentario demasiado corto' })
    assert.strictEqual(await contarComentarios(), antes)
  })

  test('valida en orden: el nombre va antes que el correo', async ({ client }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client.post(`/posts/${SLUG}/comentarios`).json({ cuerpo: 'x' })

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ error: 'El nombre es obligatorio' })
  })

  test('valida en orden: el correo vacío va antes que el cuerpo', async ({ client }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json({ autor_nombre: 'Lucía', cuerpo: 'x' })

    // Assert
    respuesta.assertStatus(422)
    respuesta.assertBody({ message: 'Falta el email' })
  })

  test('valida en orden: el correo sin @ va antes que el cuerpo', async ({ client }) => {
    // Arrange
    await db.table('posts').insert(unPost())

    // Act
    const respuesta = await client
      .post(`/posts/${SLUG}/comentarios`)
      .json({ autor_nombre: 'Lucía', autor_email: 'sin-arroba', cuerpo: 'x' })

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ errores: ['email no válido'] })
  })
})

/* -------------------------------------------------------------------------
 * DELETE /comentarios/:id
 * ---------------------------------------------------------------------- */
test.group('DELETE /comentarios/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('BUG CARACTERIZADO (hallazgo 2): borra un comentario aprobado con solo su correo', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario({ estado: 'aprobado' }))

    // Act
    const respuesta = await client
      .delete('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es' })

    // Assert
    respuesta.assertStatus(200)
    respuesta.assertBody({ borrado: true })
    assert.isNull(await buscarComentario(9101))
  })

  test('compara el correo sin distinguir mayúsculas ni espacios', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .delete('/comentarios/9101')
      .json({ autor_email: '  ANA.Cortes@Ejemplo.ES ' })

    // Assert
    respuesta.assertStatus(200)
    respuesta.assertBody({ borrado: true })
    assert.isNull(await buscarComentario(9101))
  })

  test('BUG CARACTERIZADO (hallazgo 3): borra con la clave de moderación fija y sin correo', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario({ estado: 'aprobado' }))

    // Act
    const respuesta = await client
      .delete('/comentarios/9101')
      .header('x-clave-moderacion', CLAVE_MODERACION_ACTUAL)

    // Assert
    respuesta.assertStatus(200)
    respuesta.assertBody({ borrado: true })
    assert.isNull(await buscarComentario(9101))
  })

  test('devuelve 403 con un correo distinto y no borra', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .delete('/comentarios/9101')
      .json({ autor_email: 'otra.persona@ejemplo.es' })

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes borrar este comentario' })
    assert.isNotNull(await buscarComentario(9101))
  })

  test('devuelve 403 con una clave de moderación incorrecta', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .delete('/comentarios/9101')
      .header('x-clave-moderacion', 'otra-clave')

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes borrar este comentario' })
    assert.isNotNull(await buscarComentario(9101))
  })

  test('devuelve 403 sin correo ni clave', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client.delete('/comentarios/9101')

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes borrar este comentario' })
    assert.isNotNull(await buscarComentario(9101))
  })

  test('devuelve 404 si el comentario no existe', async ({ client }) => {
    // Act
    const respuesta = await client
      .delete('/comentarios/999999')
      .header('x-clave-moderacion', CLAVE_MODERACION_ACTUAL)

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Comentario no encontrado' })
  })

  test('devuelve 404 si el id no es numérico', async ({ client }) => {
    // Act
    const respuesta = await client.delete('/comentarios/abc')

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Comentario no encontrado' })
  })
})

/* -------------------------------------------------------------------------
 * PATCH /comentarios/:id
 * ---------------------------------------------------------------------- */
test.group('PATCH /comentarios/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('edita el cuerpo de un comentario pendiente con el correo exacto', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es', cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(200)
    const cuerpo = respuesta.body()
    assert.sameMembers(Object.keys(cuerpo), ['comentario'])
    assert.sameMembers(Object.keys(cuerpo.comentario), CAMPOS_COMENTARIO)
    // BUG CARACTERIZADO (hallazgo 1/4): la respuesta incluye autor_email.
    assert.deepEqual(cuerpo.comentario, {
      id: 9101,
      post_id: POST_ID,
      autor_nombre: 'Ana Cortés',
      autor_email: 'ana.cortes@ejemplo.es',
      cuerpo: 'Cuerpo editado.',
      estado: 'pendiente',
      creado_en: '2026-02-01 09:30:00',
      padre_id: null,
    })
    const guardado = await buscarComentario(9101)
    assert.strictEqual(guardado.cuerpo, 'Cuerpo editado.')
  })

  test('devuelve creado_en null si el comentario se guardó sin fecha', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario({ creado_en: null }))

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es', cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(200)
    assert.isNull(respuesta.body().comentario.creado_en)
  })

  test('BUG CARACTERIZADO (hallazgo 10): acepta un cuerpo de menos de 5 caracteres', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es', cuerpo: 'ab' })

    // Assert
    respuesta.assertStatus(200)
    assert.strictEqual(respuesta.body().comentario.cuerpo, 'ab')
  })

  test('BUG CARACTERIZADO (hallazgo 9): con el correo en otras mayúsculas devuelve 403', async ({
    client,
    assert,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ANA.CORTES@EJEMPLO.ES', cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes editar este comentario' })
    const guardado = await buscarComentario(9101)
    assert.strictEqual(guardado.cuerpo, 'Un comentario ya guardado.')
  })

  test('BUG CARACTERIZADO (hallazgo 9): la clave de moderación no sirve para editar', async ({
    client,
  }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .header('x-clave-moderacion', CLAVE_MODERACION_ACTUAL)
      .json({ cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes editar este comentario' })
  })

  test('devuelve 403 si el comentario ya no está pendiente', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario({ estado: 'aprobado' }))

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es', cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes editar este comentario' })
    const guardado = await buscarComentario(9101)
    assert.strictEqual(guardado.cuerpo, 'Un comentario ya guardado.')
  })

  test('sin cuerpo devuelve 400 {error}', async ({ client, assert }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'ana.cortes@ejemplo.es' })

    // Assert
    respuesta.assertStatus(400)
    respuesta.assertBody({ error: 'Falta el cuerpo' })
    const guardado = await buscarComentario(9101)
    assert.strictEqual(guardado.cuerpo, 'Un comentario ya guardado.')
  })

  test('la autorización va antes que la validación del cuerpo', async ({ client }) => {
    // Arrange
    await db.table('posts').insert(unPost())
    await db.table('comentarios').insert(unComentario())

    // Act
    const respuesta = await client
      .patch('/comentarios/9101')
      .json({ autor_email: 'otra.persona@ejemplo.es' })

    // Assert
    respuesta.assertStatus(403)
    respuesta.assertBody({ error: 'No puedes editar este comentario' })
  })

  test('devuelve 404 si el comentario no existe', async ({ client }) => {
    // Act
    const respuesta = await client
      .patch('/comentarios/999999')
      .json({ autor_email: 'ana.cortes@ejemplo.es', cuerpo: 'Cuerpo editado.' })

    // Assert
    respuesta.assertStatus(404)
    respuesta.assertBody({ error: 'Comentario no encontrado' })
  })
})
