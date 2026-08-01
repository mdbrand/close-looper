import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const importExportRouter = router({
  exportContacts: protectedProcedure.query(async ({ ctx }) => {
    const contacts = await db.getContacts(ctx.user.id);
    
    // Generate CSV
    const headers = [
      "First Name", "Last Name", "Email", "Phone", "Company", "Industry",
      "Relationship Type", "How We Met", "Personal Notes", "LinkedIn", "Instagram",
      "Facebook", "Birthday", "Loop Status", "Send Frequency (weeks)", "Tags"
    ];
    
    const rows = contacts.map(c => [
      c.firstName,
      c.lastName || "",
      c.email,
      c.phone || "",
      c.company || "",
      c.industry || "",
      c.relationshipType,
      c.howWeMet || "",
      c.personalNotes || "",
      c.linkedinUrl || "",
      c.instagramUrl || "",
      c.facebookUrl || "",
      c.birthday || "",
      c.loopStatus,
      c.sendFrequencyWeeks,
      c.tags || "",
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
      if (lines.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have at least headers and one row" });
      
      const rawHeaders = parseCSVLine(lines[0]!);
      const mappedHeaders = rawHeaders.map(h => h.trim().toLowerCase());
      const columnMapping = rawHeaders.map((raw, i) => ({ original: raw, mapped: mappedHeaders[i]! }));
      const rows = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]?.trim()) continue;
        const cells = parseCSVLine(lines[i]!);
        const row: Record<string, string> = {};
        mappedHeaders.forEach((h, idx) => {
          row[h] = (cells[idx] || "") as string;
        });
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
      const results = { imported: 0, skipped: 0, errors: [] as string[] };
      const existingEmails = new Set((await db.getContacts(ctx.user.id)).map(c => c.email.toLowerCase()));
      
      for (const row of input.rows) {
        try {
          const email = (row["email"] as string | undefined)?.trim();
          const firstName = (row["first name"] as string | undefined)?.trim();
          
          if (!email || !firstName) {
            results.errors.push(`Skipped row: missing email or first name`);
            continue;
          }
          
          if (input.skipDuplicates && existingEmails.has((email as string).toLowerCase())) {
            results.skipped++;
            continue;
          }
          
          await db.createContact({
            userId: ctx.user.id,
            firstName,
            lastName: (row["last name"] as string | undefined)?.trim() || undefined,
            email: email as string,
            phone: (row["phone"] as string | undefined)?.trim() || undefined,
            company: (row["company"] as string | undefined)?.trim() || undefined,
            industry: (row["industry"] as string | undefined)?.trim() || undefined,
            relationshipType: ((row["relationship type"] as string | undefined)?.toLowerCase() as any) || "referral_partner",
            howWeMet: (row["how we met"] as string | undefined)?.trim() || undefined,
            personalNotes: (row["personal notes"] as string | undefined)?.trim() || undefined,
            linkedinUrl: (row["linkedin"] as string | undefined)?.trim() || undefined,
            instagramUrl: (row["instagram"] as string | undefined)?.trim() || undefined,
            facebookUrl: (row["facebook"] as string | undefined)?.trim() || undefined,
            birthday: (row["birthday"] as string | undefined)?.trim() || undefined,
            loopStatus: "active",
            sendFrequencyWeeks: parseInt((row["send frequency (weeks)"] as string | undefined) || "4") || 4,
            tags: (row["tags"] as string | undefined)?.trim() || undefined,
          });
          
          results.imported++;
          existingEmails.add((email as string).toLowerCase());
        } catch (e) {
          results.errors.push(`Error importing row: ${String(e)}`);
        }
      }
      
      return results;
    }),

  getImportHistory: protectedProcedure.query(async ({ ctx }) => {
    const database = await db.getDb();
    if (!database) return [];
    const { importBatches } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return database.select().from(importBatches).where(eq(importBatches.userId, ctx.user.id)).orderBy(importBatches.createdAt);
  }),

  undoImport: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { importBatches, contacts } = await import("../../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");
      const batch = await database.select().from(importBatches)
        .where(and(eq(importBatches.id, input.batchId), eq(importBatches.userId, ctx.user.id)))
        .limit(1);
      if (!batch[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const contactIds: number[] = JSON.parse(batch[0].contactIds || "[]");
      if (contactIds.length > 0) {
        await database.delete(contacts).where(and(eq(contacts.userId, ctx.user.id), inArray(contacts.id, contactIds)));
      }
      await database.delete(importBatches).where(eq(importBatches.id, input.batchId));
      return { deleted: contactIds.length };
    }),
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
