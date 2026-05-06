import Link from "next/link";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { db } from "@/lib/db";

type SuccessProps = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function SuccessPage({ searchParams }: SuccessProps) {
  const params = await searchParams;
  const order = params.orderId
    ? await db.order.findUnique({
        where: { id: params.orderId },
        include: { items: true, company: true },
      })
    : null;
  const total = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-xl rounded-lg border border-green-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-3xl text-white">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-green-700">Siparişiniz Alındı</h1>
        <p className="mt-2 text-sm text-gray-600">Sipariş No: {params.orderId ?? "-"}</p>
        {order ? (
          <div className="mt-4 space-y-2 text-left">
            <p className="font-semibold">Firma: {order.company.name}</p>
            <div className="rounded border">
              {ALL_CATEGORIES.map((category) => (
                <div key={category} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0">
                  <span>{CATEGORY_LABELS[category]}</span>
                  <span className="font-semibold">{order.items.find((item) => item.category === category)?.quantity ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="text-right font-bold">Toplam Porsiyon: {total}</p>
          </div>
        ) : null}
        <Link href="/" className="mt-6 inline-flex rounded bg-green-600 px-4 py-2 font-semibold text-white">
          Yeni Sipariş Ver
        </Link>
      </div>
    </main>
  );
}
