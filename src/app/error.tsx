"use client";

type ErrorProps = {
  error: Error;
  reset: () => void;
};

export default function RootError({ error, reset }: ErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-red-300 bg-white p-6 text-center">
        <h1 className="text-xl font-bold text-red-700">Bir hata oluştu</h1>
        <p className="mt-2 text-sm text-slate-600">{error.message || "Beklenmeyen bir hata oluştu."}</p>
        <button className="mt-4 rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => reset()}>
          Tekrar Dene
        </button>
      </div>
    </main>
  );
}
