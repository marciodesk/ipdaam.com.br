import { getAccess, hashPassword, verifyPassword } from "../_auth.js";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, init = {}) => new Response(JSON.stringify(data), { ...init, headers: { ...headers, ...(init.headers || {}) } });

export async function onRequestPost({ request, env }) {
  try {
    const access = await getAccess(request, env);
    if (!access?.userId) return json({ error: "Entre com sua conta de professor para trocar a senha." }, { status: 401 });
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 6) return json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    const user = await env.DB.prepare("SELECT password_hash FROM attendance_users WHERE id=? AND active=1").bind(access.userId).first();
    if (!user || !await verifyPassword(currentPassword, user.password_hash)) return json({ error: "Senha atual incorreta." }, { status: 400 });
    await env.DB.prepare("UPDATE attendance_users SET password_hash=?, updated_at=datetime('now') WHERE id=?")
      .bind(await hashPassword(newPassword), access.userId).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "Nao foi possivel trocar a senha." }, { status: 400 });
  }
}

