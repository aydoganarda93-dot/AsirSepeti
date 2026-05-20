import type { CompanyGridPayload } from "@/lib/company-admin-grid";

export type GridRowLike = CompanyGridPayload & {
  id: string;
  companyName: string;
};

export function parseCellNumber(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const match = /^(\d+)/.exec(trimmed);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function isCellEmpty(value: string): boolean {
  return parseCellNumber(value) === 0;
}

/** Geliştirme / demo: ?gridDemo=1 ile URL'de örnek veri */
const DEMO_BY_NAME: Record<string, Partial<CompanyGridPayload>> = {
  autointel: {
    oglenEkmek: "4",
    aksamEkmek: "4",
    geceEkmek: "4",
  },
  "mert deneme": {
    oglen: "15",
    geceKumanya: "10",
  },
  mirsan: {
    oglenEkmek: "32",
    oglenEkmekArasi: "11",
    oglenKumanya: "11",
    aksamEkmek: "64",
    aksamEkmekArasi: "11",
    aksamKumanya: "42",
    geceEkmek: "21",
    geceKumanya: "65",
  },
};

export function applyGridDemoOverlay<T extends GridRowLike>(rows: T[], enabled: boolean): T[] {
  if (!enabled) return rows;
  return rows.map((row) => {
    const key = row.companyName.trim().toLocaleLowerCase("tr");
    const demo = DEMO_BY_NAME[key];
    if (!demo) return row;
    return { ...row, ...demo };
  });
}
