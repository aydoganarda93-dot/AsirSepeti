"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog bileşenleri Dialog içinde kullanılmalıdır.");
  }
  return context;
}

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

export function DialogContent({
  className,
  children,
  size = "default",
}: {
  className?: string;
  children: React.ReactNode;
  /** Menü gibi geniş içerikler için neredeyse tam ekran */
  size?: "default" | "fullscreen";
}) {
  const { open, onOpenChange } = useDialogContext();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const fullscreen = size === "fullscreen";

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <button
        type="button"
        className="fixed inset-0 bg-black/45"
        aria-label="Dialog kapat"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "flex h-full min-h-full items-center justify-center",
          fullscreen ? "p-1 sm:p-2" : "overflow-y-auto p-4 sm:p-6",
        )}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative z-10 w-full rounded-xl border border-slate-200 bg-white shadow-xl",
            !fullscreen && "max-w-lg",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex items-center justify-end gap-2", className)} {...props} />;
}
