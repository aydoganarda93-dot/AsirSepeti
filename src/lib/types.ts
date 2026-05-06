import { ItemCategory, ItemStatus, OrderStatus } from "@prisma/client";

export type AdminOrder = {
  id: string;
  orderDate: string;
  contactName: string;
  notes: string | null;
  status: OrderStatus;
  company: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    category: ItemCategory;
    quantity: number;
    status: ItemStatus;
  }>;
};
