"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

type SsePayload = {
  type: "order.changed" | "order.deleted";
  orderId: string;
  ts: number;
};

function playNotificationBeep() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    /* sessiz */
  }
}

export function AdminOrderAlerts() {
  const seenKeysRef = useRef<Set<string>>(new Set());
  const audioUnlockedRef = useRef(false);
  const connectedRef = useRef(false);

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [unlockAudio]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const source = new EventSource("/api/sse");

    source.onopen = () => {
      connectedRef.current = true;
    };

    const onConnected = () => {
      connectedRef.current = true;
    };

    const onUpdate = (event: MessageEvent) => {
      if (!connectedRef.current) return;
      let payload: SsePayload;
      try {
        payload = JSON.parse(event.data as string) as SsePayload;
      } catch {
        return;
      }
      if (!payload?.orderId || !payload?.type) return;

      const key = `${payload.type}:${payload.orderId}:${payload.ts}`;
      if (seenKeysRef.current.has(key)) return;
      seenKeysRef.current.add(key);
      if (seenKeysRef.current.size > 400) {
        const arr = [...seenKeysRef.current];
        seenKeysRef.current = new Set(arr.slice(-200));
      }

      if (payload.type === "order.changed") {
        toast.message("Sipariş güncellendi", {
          description: `Sipariş #${payload.orderId.slice(0, 8)}… — Catering veya geçmişi kontrol edin.`,
        });
        if (audioUnlockedRef.current) {
          playNotificationBeep();
        }
      } else if (payload.type === "order.deleted") {
        toast.message("Sipariş kaldırıldı", {
          description: `Kayıt #${payload.orderId.slice(0, 8)}…`,
        });
      }
    };

    source.addEventListener("connected", onConnected);
    source.addEventListener("update", onUpdate);

    return () => {
      source.removeEventListener("connected", onConnected);
      source.removeEventListener("update", onUpdate);
      source.close();
    };
  }, []);

  return (
    <p className="text-[11px] text-slate-500">
      Bildirim sesi için sayfada bir kez tıklayın (tarayıcı kısıtı).
    </p>
  );
}
