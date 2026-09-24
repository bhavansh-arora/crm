import { prisma } from "@/lib/prisma";
import { toWhatsAppNumber } from "@/lib/phone";

// A lead's phone can be stored in whatever format it was entered/pushed in
// ("9876543210", "+91 98765 43210", "+1 555-123-4567", ...), so comparing
// exact strings misses real duplicates. toWhatsAppNumber() normalizes to
// digits-only with a country code applied, which both the CRM's own "New
// Lead" form and the external (Leads Finder) ingestion endpoint use to
// check for an existing match before creating.
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return toWhatsAppNumber(phone) || null;
}

export type PhoneLookup = Map<string, { id: string; name: string }>;

// One query for every phone number currently in the CRM, keyed by its
// normalized form -- fetch this once per request (not once per lead in a
// batch) and pass it to isDuplicatePhone / recordPhone as leads are
// processed.
export async function loadPhoneLookup(): Promise<PhoneLookup> {
  const leads = await prisma.lead.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  const lookup: PhoneLookup = new Map();
  for (const lead of leads) {
    const normalized = normalizePhone(lead.phone);
    if (normalized) lookup.set(normalized, { id: lead.id, name: lead.name });
  }
  return lookup;
}
