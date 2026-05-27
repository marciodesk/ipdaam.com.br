const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, x-admin-password",
};

const jsonHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {}),
    },
  });
}

function errorJson(error, status = 500) {
  return json({
    ok: false,
    error: error && error.message ? error.message : String(error),
  }, { status });
}

function unauthorized() {
  return json({ ok: false, error: "Acesso nao autorizado." }, { status: 401 });
}

function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("Variavel ADMIN_PASSWORD nao configurada.");
  }

  const password = request.headers.get("x-admin-password") || "";
  return password === env.ADMIN_PASSWORD;
}

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

function getBucket(env) {
  if (!env.PHOTOS) {
    throw new Error("R2 binding PHOTOS nao configurado. Verifique o vinculo do bucket em Producao.");
  }

  return env.PHOTOS;
}

function decodeJpegDataUrl(dataUrl) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) {
    throw new Error("Foto invalida. Capture a imagem novamente.");
  }

  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getEnrollment(db, id) {
  const row = await db.prepare("SELECT payload FROM enrollments WHERE id = ?").bind(id).first();
  if (!row) {
    throw new Error("Matricula nao encontrada.");
  }

  return JSON.parse(row.payload);
}

async function saveEnrollmentPayload(db, enrollment) {
  const payload = JSON.stringify(enrollment);
  await db.prepare(
    `UPDATE enrollments SET
      payload = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  )
    .bind(payload, enrollment.id)
    .run();
}

export async function onRequestGet({ request, env, params }) {
  try {
    if (!requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const bucket = getBucket(env);
    const enrollment = await getEnrollment(db, params.id);
    const key = enrollment.candidatePhotoKey || `candidate-photos/${params.id}.jpg`;
    const object = await bucket.get(key);

    if (!object) {
      return json({ ok: false, error: "Foto nao encontrada." }, { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        "content-type": object.httpMetadata?.contentType || "image/jpeg",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    if (!requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const bucket = getBucket(env);
    const body = await request.json();
    const bytes = decodeJpegDataUrl(body.image);
    const capturedAt = body.capturedAt || new Date().toISOString();
    const key = `candidate-photos/${params.id}.jpg`;

    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: "image/jpeg",
      },
    });

    const enrollment = await getEnrollment(db, params.id);
    enrollment.candidatePhotoKey = key;
    enrollment.candidatePhotoCapturedAt = capturedAt;
    enrollment.updatedAt = new Date().toISOString();
    delete enrollment.candidatePhoto;
    await saveEnrollmentPayload(db, enrollment);

    return json({
      ok: true,
      candidatePhotoKey: key,
      candidatePhotoCapturedAt: capturedAt,
    }, { status: 201 });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  });
}
