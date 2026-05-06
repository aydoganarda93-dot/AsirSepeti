import { NextResponse } from "next/server";
import { subscribeSse } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { ok: true, ts: Date.now() });
      const timer = setInterval(() => send("ping", { ts: Date.now() }), 15000);
      const unsubscribe = subscribeSse((payload) => send("update", payload));

      return () => {
        clearInterval(timer);
        unsubscribe();
      };
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
