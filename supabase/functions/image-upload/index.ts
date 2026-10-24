import { cors, json, service } from "../_shared/client.ts";
Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, 405, headers);
  if (req.headers.get("origin") !== Deno.env.get("ALLOWED_ORIGIN"))
    return json({ error: "Origin denied" }, 403, headers);
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return json({ error: "Unauthorized" }, 401, headers);
  const admin = service();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "Unauthorized" }, 401, headers);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .single();
  if (!role || !["board", "admin"].includes(role.role))
    return json({ error: "Forbidden" }, 403, headers);
  const length = Number(req.headers.get("content-length"));
  if (length > 4300000) return json({ error: "File too large" }, 413, headers);
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 4194304)
      return json({ error: "Invalid file" }, 400, headers);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg =
      file.type === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255;
    const png =
      file.type === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
    const webp =
      file.type === "image/webp" &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!jpeg && !png && !webp)
      return json(
        { error: "Only valid JPEG, PNG, WebP images are accepted" },
        400,
        headers,
      );
    const { data: files, error: listError } = await admin.storage
      .from("event-images")
      .list(data.user.id, { limit: 100 });
    if (listError || !files || files.length >= 100)
      return json(
        {
          error: "Image quota reached. Remove unused images before uploading.",
        },
        429,
        headers,
      );
    const path = `${data.user.id}/${crypto.randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
    // Service-owned association assets survive a board member's account deletion.
    const { error: uploadError } = await admin.storage
      .from("event-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    return uploadError
      ? json({ error: "Upload failed" }, 503, headers)
      : json({ path }, 200, headers);
  } catch {
    return json({ error: "Invalid upload" }, 400, headers);
  }
});
