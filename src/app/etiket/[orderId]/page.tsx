import { ItemCategory, Shift } from "@prisma/client";
import { notFound } from "next/navigation";
import { ThermalLabel } from "@/components/thermal-label";
import { db } from "@/lib/db";

type LabelPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ category?: string; shift?: string }>;
};

export default async function LabelPage({ params, searchParams }: LabelPageProps) {
  const { orderId } = await params;
  const { category, shift } = await searchParams;
  if (!category || !shift) notFound();

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { company: true, items: true },
  });
  if (!order) notFound();

  const current = order.items.find((item) => item.category === category && item.shift === shift);
  if (!current) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4">
      <ThermalLabel
        autoPrint
        orderId={order.id}
        companyName={order.company.name}
        orderDate={order.orderDate}
        category={current.category as ItemCategory}
        shift={current.shift as Shift}
        quantity={current.quantity}
        notes={order.notes}
      />
    </main>
  );
}
