"use client";

import { ItemCategory } from "@prisma/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";
import { CATEGORY_LABELS } from "@/lib/categories";

type ThermalLabelProps = {
  orderId: string;
  companyName: string;
  orderDate: Date;
  category: ItemCategory;
  quantity: number;
  notes?: string | null;
  autoPrint?: boolean;
};

export function ThermalLabel({
  orderId,
  companyName,
  orderDate,
  category,
  quantity,
  notes,
  autoPrint,
}: ThermalLabelProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const shortNote = notes ? notes.slice(0, 60) : "";

  useEffect(() => {
    if (!barcodeRef.current) return;
    JsBarcode(barcodeRef.current, orderId, {
      format: "CODE128",
      displayValue: true,
      height: 40,
      margin: 0,
    });
  }, [orderId]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 120);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="thermal-label w-[302px] bg-white p-4 font-mono text-black">
      <h2 className="text-lg font-bold">{companyName}</h2>
      <p>{format(orderDate, "dd.MM.yyyy", { locale: tr })}</p>
      <p>{CATEGORY_LABELS[category]}</p>
      <p className="text-xl font-bold">{quantity} kişi</p>
      {shortNote ? <p>Not: {shortNote}</p> : null}
      <svg ref={barcodeRef} className="barcode mt-2 w-full" />
    </div>
  );
}
