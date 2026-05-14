import { ItemCategory, ItemStatus, OrderKind, OrderStatus, Shift } from "@prisma/client";

export type AdminOrder = {
  id: string;
  orderDate: string;
  /** ISO datetime — siparişin veritabanına düştüğü an */
  createdAt: string;
  kind: OrderKind;
  contactName: string;
  notes: string | null;
  status: OrderStatus;
  company: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    shift: Shift;
    category: ItemCategory;
    quantity: number;
    status: ItemStatus;
  }>;
  activities?: Array<{
    id: string;
    type: string;
    meta: unknown;
    createdAt: string;
  }>;
};
