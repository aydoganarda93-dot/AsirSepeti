"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onFinish: () => void;
};

export function CustomerOrderSuccessSplash({ onFinish }: Props) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const started = Date.now();
    const duration = 2000;
    let raf = 0;

    const loop = () => {
      if (doneRef.current) return;
      const elapsed = Date.now() - started;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);
      if (next < 100) {
        raf = requestAnimationFrame(loop);
      } else {
        window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onFinish();
          }
        }, 450);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      doneRef.current = true;
      cancelAnimationFrame(raf);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 p-6 backdrop-blur-sm">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-100 bg-emerald-50 shadow-lg shadow-emerald-200/40">
        <Check className="h-10 w-10 text-emerald-600" strokeWidth={3} aria-hidden />
      </div>
      <h2 className="mb-2 text-center text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
        Başarıyla iletildi
      </h2>
      <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-slate-600">
        Siparişiniz mutfağa ulaştı; şu an hazırlanıyor. Onay için siparişlerinizi aşağıdan takip edebilirsiniz.
      </p>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600")}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-medium text-emerald-800">{progress}%</p>
    </div>
  );
}
