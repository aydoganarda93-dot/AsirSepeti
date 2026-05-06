import { ItemCategory } from "@prisma/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CATEGORY_LABELS } from "@/lib/categories";

type ThermalLabelProps = {
  orderId: string;
  companyName: string;
  orderDate: Date;
  category: ItemCategory;
  quantity: number;
  notes?: string | null;
};

export function ThermalLabel({
  orderId,
  companyName,
  orderDate,
  category,
  quantity,
  notes,
}: ThermalLabelProps) {
  const shortNote = notes ? notes.slice(0, 60) : "";
  return (
    <div className="thermal-label w-[302px] bg-white p-4 font-mono text-black">
      <h2 className="text-lg font-bold">{companyName}</h2>
      <p>{format(orderDate, "dd.MM.yyyy", { locale: tr })}</p>
      <p>{CATEGORY_LABELS[category]}</p>
      <p className="text-xl font-bold">{quantity} kişi</p>
      {shortNote ? <p>Not: {shortNote}</p> : null}
      <div className="barcode mt-2 h-10 border border-black text-center text-xs leading-10">
        {orderId}
      </div>
    </div>
  );
}
