import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  }

  const body = await request.json().catch(() => null) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email.includes("@") || !email.includes(".") || password.length < 6) {
    return Response.json(
      { error: "Escribe un correo válido y una contraseña de al menos 6 caracteres." },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Faltan las credenciales de Supabase." }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = await findUserId(admin, email);
  if (!userId) {
    return Response.json({ error: "No hay una cuenta con ese correo." }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) {
    return Response.json({ error: "No se pudo cambiar la contraseña." }, { status: 400 });
  }
  return Response.json({ ok: true });
});

async function findUserId(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
