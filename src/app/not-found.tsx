import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded border bg-white p-6 text-center">
        <h1 className="text-xl font-bold">Sayfa Bulunamadı</h1>
        <p className="mt-2 text-sm text-slate-600">İstediğiniz sayfaya ulaşılamadı.</p>
        <Link href="/" className="mt-4 inline-flex rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
