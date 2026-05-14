/** Twilio / generic webhook gövdelerinden ortak alan çıkarımı */

export type ExtractedInbound = {
  fromRaw: string;
  /** Alıcı hat (Twilio To) — işletme WhatsApp hattı ile eşleşir */
  toRaw?: string;
  body: string;
  externalId?: string;
};

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(record)) {
      if (k.toLowerCase() === lower && typeof v === "string") return v;
    }
  }
  return "";
}

export async function extractInboundPayload(request: Request): Promise<ExtractedInbound | null> {
  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    const raw = (await request.json()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const entryUnknown = o.entry;
    const entry0 =
      Array.isArray(entryUnknown) && entryUnknown[0] && typeof entryUnknown[0] === "object"
        ? (entryUnknown[0] as Record<string, unknown>)
        : null;
    const changes = entry0?.changes;
    const ch0 =
      Array.isArray(changes) && changes[0] && typeof changes[0] === "object"
        ? (changes[0] as Record<string, unknown>)
        : null;
    const value = ch0?.value && typeof ch0.value === "object" ? (ch0.value as Record<string, unknown>) : null;
    const messages = value?.messages;
    const msg0 =
      Array.isArray(messages) && messages[0] && typeof messages[0] === "object"
        ? (messages[0] as Record<string, unknown>)
        : null;

    const messagesTop = o.messages;
    const msgTop =
      Array.isArray(messagesTop) && messagesTop[0] && typeof messagesTop[0] === "object"
        ? (messagesTop[0] as Record<string, unknown>)
        : null;

    const nested =
      (typeof o.message === "object" && o.message !== null ? o.message : null) ?? msgTop ?? msg0;
    const bucket =
      nested && typeof nested === "object"
        ? { ...o, ...(nested as Record<string, unknown>) }
        : o;

    const fromRaw =
      pickString(bucket as Record<string, unknown>, ["From", "from", "wa_id", "WaId"]) ||
      (typeof (bucket as { sender?: unknown }).sender === "object" &&
      (bucket as { sender?: { id?: string } }).sender?.id
        ? String((bucket as { sender?: { id?: string } }).sender?.id)
        : "");

    const toRaw =
      pickString(bucket as Record<string, unknown>, ["To", "to", "recipient_id"]) || undefined;

    const body =
      pickString(bucket as Record<string, unknown>, ["Body", "body", "text"]) ||
      pickString(bucket as Record<string, unknown>, ["message", "Message"]);

    const externalId =
      pickString(bucket as Record<string, unknown>, ["MessageSid", "id", "message_id"]) ||
      undefined;

    if (!fromRaw.trim()) return null;
    return { fromRaw, toRaw, body: body || "", externalId };
  }

  const form = await request.formData();
  const record: Record<string, unknown> = {};
  form.forEach((value, key) => {
    record[key] = typeof value === "string" ? value : String(value);
  });

  const fromRaw =
    pickString(record, ["From", "from", "WaId"]) ||
    String(record.From ?? record.from ?? "");

  const toRaw = pickString(record, ["To", "to"]) || undefined;

  const body = pickString(record, ["Body", "body"]) || "";
  const externalId = pickString(record, ["MessageSid", "SmsSid", "id"]) || undefined;

  if (!fromRaw.trim()) return null;
  return { fromRaw, toRaw, body, externalId };
}
