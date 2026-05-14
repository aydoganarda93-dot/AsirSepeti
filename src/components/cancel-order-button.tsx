"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CancelOrderButtonProps = {
  orderId: string;
  cancelToken: string;
};

export function CancelOrderButton({ orderId, cancelToken }: CancelOrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onCancel = async () => {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelToken }),
    });
    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Sipariş iptal edilemedi.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="inline-flex rounded bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "İptal Ediliyor..." : "Siparişi İptal Et"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
