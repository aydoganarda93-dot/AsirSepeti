"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  submitError: string;
  submitting: boolean;
  submitLabel: string;
};

export function CustomerOrderFooter({ register, errors, submitError, submitting, submitLabel }: Props) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-inner">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Not (isteğe bağlı)</p>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          rows={3}
          maxLength={2000}
          placeholder="Sipariş notunuz"
          {...register("notes")}
        />
        {errors.notes ? (
          <p className="mt-1 text-sm text-red-600">{String(errors.notes.message ?? "")}</p>
        ) : null}
        {submitError ? <p className="mt-2 text-sm text-red-600">{submitError}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? "Gönderiliyor…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
