import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { readSseEventsSince, subscribeSse } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Yetkisiz. Bu akış yalnızca yönetici oturumu ile kullanılabilir." },
      { status: 401 },
    );
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let dbSyncTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let lastSeenTs = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { ok: true, ts: Date.now() });
      timer = setInterval(() => send("ping", { ts: Date.now() }), 15000);
      unsubscribe = subscribeSse((payload) => {
        lastSeenTs = Math.max(lastSeenTs, payload.ts);
        send("update", payload);
      });
      dbSyncTimer = setInterval(() => {
        void readSseEventsSince(lastSeenTs)
          .then((events) => {
            for (const event of events) {
              lastSeenTs = Math.max(lastSeenTs, event.ts);
              send("update", event);
            }
          })
          .catch(() => undefined);
      }, 2000);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (dbSyncTimer) clearInterval(dbSyncTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
