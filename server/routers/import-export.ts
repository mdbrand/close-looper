import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { getDb } from "../db";
import { importBatches, contacts } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

// Smart column mapping: maps common CSV header variations to our field names
const COLUMN_MAP: Record<string, string[]> = {
  "first name": ["first name", "firstname", "first_name", "fname", "given name", "name"],
  "last name": ["last name", "lastname", "last_name", "lname", "surname", "family name"],
  "email": ["email", "email address", "e-mail", "mail"],
  "phone": ["phone", "phone number", "telephone", "tel", "mobile", "cell"],
  "company": ["company", "company name", "organization", "org", "business"],
  "industry": ["industry", "sector", "niche", "field"],
  "relationship type": ["relationship type", "relationship", "rel type", "type", "contact type"],
  "how we met": ["how we met", "how met", "source", "referral source", "met at"],
  "personal notes": ["personal notes", "notes", "comments", "memo"],
  "linkedin": ["linkedin", "linkedin url", "linkedin link", "li"],
  "instagram": ["instagram", "instagram url", "ig", "insta"],
  "facebook": ["facebook", "facebook url", "fb"],
  "birthday": ["birthday", "bday", "birth date", "dob", "date of birth"],
  "send frequency (weeks)": ["send frequency (weeks)", "frequency", "send frequency", "freq", "cadence"],
  "tags": ["tags", "labels", "categories", "groups"],
};

function mapHeader(rawHeader: string): string {
  const normalized = rawHeader.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
    if (variants.includes(normalized)) return canonical;
  }
  return normalized;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export const importExportRouter = router({
  exportContacts: protectedProcedure.query(async ({ ctx }) => {
    const allContacts = await db.getContacts(ctx.user.id);
    const headers = [
      "First Name", "Last Name", "Email", "Phone", "Company", "Industry",
      "Relationship Type", "How We Met", "Personal Notes", "LinkedIn", "Instagram",
      "Facebook", "Birthday", "Loop Status", "Send Frequency (weeks)", "Tags"
    ];
    const rows = allContacts.map(c => [
      c.firstName, c.lastName || "", c.email, c.phone || "", c.company || "",
      c.industry || "", c.relationshipType, c.howWeMet || "", c.personalNotes || "",
      c.linkedinUrl || "", c.instagramUrl || "", c.facebookUrl || "",
      c.birthday || "", c.loopStatus, c.sendFrequencyWeeks, c.tags || "",
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(cell => {
        const str = String(cell || "");
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    ).join("\n");
    return { csv, filename: `close-looper-contacts-${new Date().toISOString().split("T")[0]}.csv` };
  }),

  parseImportCSV: protectedProcedure
    .input(z.object({ csvContent: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lines = input.csvContent.trim().split("\n");
      if (lines.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have headers and at least one row" });

      const rawHeaders = parseCSVLine(lines[0]!);
      const mappedHeaders = rawHeaders.map(h => mapHeader(h));
      const columnMapping = rawHeaders.map((raw, i) => ({ original: raw, mapped: mappedHeaders[i]! }));

      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]?.trim()) continue;
        const cells = parseCSVLine(lines[i]!);
        const row: Record<string, string> = {};
        mappedHeaders.forEach((h, idx) => { row[h] = cells[idx] || ""; });
        rows.push(row);
      }

      return { count: rows.length, preview: rows.slice(0, 5), allRows: rows, columnMapping };
    }),

  importContacts: protectedProcedure
    .input(z.object({
      rows: z.array(z.record(z.string(), z.string())),
      skipDuplicates: z.boolean().default(true),
      filename: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = { imported: 0, skipped: 0, errors: [] as string[], importedIds: [] as number[] };
      const existingEmails = new Set((await db.getContacts(ctx.user.id)).map(c => c.email.toLowerCase()));

      for (const row of input.rows) {
        try {
          const email = row["email"]?.trim();
          const firstName = row["first name"]?.trim() || row["name"]?.trim();
          if (!email || !firstName) { results.errors.push("Skipped row: missing email or first name"); continue; }
          if (input.skipDuplicates && existingEmails.has(email.toLowerCase())) { results.skipped++; continue; }

          const id = await db.createContact({
            userId: ctx.user.id,
            firstName,
            lastName: row["last name"]?.trim() || undefined,
            email,
            phone: row["phone"]?.trim() || undefined,
            company: row["company"]?.trim() || undefined,
            industry: row["industry"]?.trim() || undefined,
            relationshipType: (row["relationship type"]?.toLowerCase() as any) || "referral_partner",
            howWeMet: row["how we met"]?.trim() || undefined,
            personalNotes: row["personal notes"]?.trim() || undefined,
            linkedinUrl: row["linkedin"]?.trim() || undefined,
            instagramUrl: row["instagram"]?.trim() || undefined,
            facebookUrl: row["facebook"]?.trim() || undefined,
            birthday: row["birthday"]?.trim() || undefined,
            loopStatus: "active",
            sendFrequencyWeeks: parseInt(row["send frequency (weeks)"] || "4") || 4,
            tags: row["tags"]?.trim() || undefined,
          });
          results.imported++;
          results.importedIds.push(id);
          existingEmails.add(email.toLowerCase());
        } catch (e) {
          results.errors.push(`Error: ${String(e)}`);
        }
      }

      // Save import batch for history/undo
      if (results.importedIds.length > 0) {
        const database = await getDb();
        if (database) {
          await database.insert(importBatches).values({
            userId: ctx.user.id,
            filename: input.filename || "import.csv",
            contactCount: results.imported,
            contactIds: JSON.stringify(results.importedIds),
          });
        }
      }

      return results;
    }),

  getImportHistory: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) return [];
    return database.select().from(importBatches).where(eq(importBatches.userId, ctx.user.id)).orderBy(importBatches.createdAt);
  }),

  undoImport: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const batch = await database.select().from(importBatches)
        .where(and(eq(importBatches.id, input.batchId), eq(importBatches.userId, ctx.user.id)))
        .limit(1);

      if (!batch[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Import batch not found" });

      const contactIds: number[] = JSON.parse(batch[0].contactIds || "[]");
      if (contactIds.length > 0) {
        await database.delete(contacts).where(
          and(eq(contacts.userId, ctx.user.id), inArray(contacts.id, contactIds))
        );
      }

      await database.delete(importBatches).where(eq(importBatches.id, input.batchId));
      return { deleted: contactIds.length };
    }),
});
