"use client";

import { addDays, format } from "date-fns";
import { useState } from "react";

type Company = { id: string; name: string };
type Props = {
  companies: Company[];
  onCreated: () => void;
};

export function AdminCreateOrder({ companies, onCreated }: Props) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [contactName, setContactName] = useState("");
  const [orderDate, setOrderDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));

  return (
    <form
      className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            contactName,
            orderDate,
            quantities: {
              OGLEN_YEMEGI: 1,
              KAPALI_KAP: 0,
              SEFERTASI: 0,
              SALATA: 0,
              KUMANYA: 0,
              TATLI: 0,
              EKMEK_ARASI: 0,
            },
          }),
        });
        setContactName("");
        onCreated();
      }}
    >
      <select className="rounded border p-2" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      <input
        className="rounded border p-2"
        placeholder="İletişim Kişisi"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
      />
      <input className="rounded border p-2" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
      <button className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">Manuel Sipariş Ekle</button>
    </form>
  );
}
