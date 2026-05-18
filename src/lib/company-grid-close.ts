import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { emptyGridPayload, parseAdminNoteToGrid, serializeGridToAdminNote } from "@/lib/company-admin-grid";
import { istanbulCalendarNoonForInstant, liveGridPeriodStart } from "@/lib/company-grid-period";

/**
 * Tamamlanmış işletme günlerini (öğle–öğle) arşivler, adminNote grid’ini sıfırlar.
 * `gridLastArchivedPeriodStart`: son başarıyla arşivlenen periyodun `periodStart` değeri.
 */
export async function runCompanyGridDayClose(now = new Date()): Promise<{ archivedPeriods: number }> {
  const todayNoon = istanbulCalendarNoonForInstant(now);
  if (now.getTime() < todayNoon.getTime()) {
    return { archivedPeriods: 0 };
  }

  let archived = 0;
  while (true) {
    const settings = await db.appSettings.findUnique({ where: { id: 1 } });
    const last = settings?.gridLastArchivedPeriodStart ?? null;
    const live = liveGridPeriodStart(now);
    const nextS = last ? addDays(last, 1) : addDays(live, -1);
    const nextE = addDays(nextS, 1);
    if (nextE.getTime() > now.getTime()) {
      break;
    }

    const companies = await db.company.findMany({ select: { id: true, adminNote: true } });

    await db.$transaction(async (tx) => {
      for (const c of companies) {
        const payload = extractGridPayloadJson(c.adminNote);
        await tx.companyGridDailyArchive.upsert({
          where: {
            companyId_periodStart: { companyId: c.id, periodStart: nextS },
          },
          create: {
            companyId: c.id,
            periodStart: nextS,
            payload,
          },
          update: { payload },
        });
        const nextLivePayload = emptyGridPayload();
        nextLivePayload.cesit = parseAdminNoteToGrid(c.adminNote).cesit;

        await tx.company.update({
          where: { id: c.id },
          data: { adminNote: serializeGridToAdminNote(nextLivePayload) },
        });
      }
      await tx.appSettings.update({
        where: { id: 1 },
        data: { gridLastArchivedPeriodStart: nextS },
      });
    });

    archived += 1;
  }

  return { archivedPeriods: archived };
}

function extractGridPayloadJson(adminNote: string | null): object {
  const empty = emptyGridPayload();
  if (!adminNote) return empty;
  const prefix = "__GRID__:";
  if (!adminNote.startsWith(prefix)) {
    return { ...empty, aciklama: adminNote };
  }
  try {
    const parsed = JSON.parse(adminNote.slice(prefix.length)) as Record<string, unknown>;
    return {
      cesit: String(parsed.cesit ?? ""),
      oglen: String(parsed.oglen ?? ""),
      oglenDetay: String(parsed.oglenDetay ?? ""),
      oglenEkmek: String(parsed.oglenEkmek ?? ""),
      aksam: String(parsed.aksam ?? ""),
      aksamEkmek: String(parsed.aksamEkmek ?? ""),
      kumanya: String(parsed.kumanya ?? ""),
      aciklama: String(parsed.aciklama ?? ""),
    };
  } catch {
    return { ...empty, aciklama: adminNote };
  }
}
