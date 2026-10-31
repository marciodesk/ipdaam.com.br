import { declarationAccess, declarationEligibility, declarationJson } from './index.js';

export async function onRequestGet({ request, env }) {
  try {
    await declarationAccess(request, env);
    const id = new URL(request.url).searchParams.get('enrollmentId') || '';
    if (!id || id.length > 100) return declarationJson({ error: 'Selecione uma matrícula.' }, 400);
    const result = await declarationEligibility(env.DB, id);
    return declarationJson({ enrollmentId: id, studies: result.studies, completion: result.completion, reasons: result.reasons });
  } catch (error) { return declarationJson({ error: error.message }, error.status || 503); }
}
