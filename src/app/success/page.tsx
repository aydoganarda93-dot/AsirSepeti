import Link from "next/link";

type SuccessProps = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function SuccessPage({ searchParams }: SuccessProps) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-green-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-3xl text-white">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-green-700">Siparişiniz Alındı</h1>
        <p className="mt-2 text-sm text-gray-600">Sipariş No: {params.orderId ?? "-"}</p>
        <Link href="/" className="mt-6 inline-flex rounded bg-green-600 px-4 py-2 font-semibold text-white">
          Yeni Sipariş Ver
        </Link>
      </div>
    </main>
  );
}
