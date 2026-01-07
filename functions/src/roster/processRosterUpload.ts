import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import {
  Boxer,
  RosterImport,
  RosterImportError,
  RosterCsvRow,
  BoxerGender,
  BoxerAvailability,
} from "../types/boxer";

/**
 * Story 4.1: Upload Draft Roster (CSV)
 *
 * Storage trigger that processes CSV uploads and creates draft boxer records.
 * Triggered when a file is uploaded to: clubs/{clubId}/rosters/{fileName}
 *
 * State Transition: CSV upload → processRosterUpload → draft boxers
 *
 * Invariants:
 * - All boxers created with dataStatus='draft'
 * - No boxer becomes active automatically
 * - boxerId is globally unique (UUID v4)
 */

interface AuditLogEntry {
  logId: string;
  action: string;
  actorId: string;
  actorType: "user" | "admin" | "system";
  targetType: string;
  targetId: string;
  targetClubId: string | null;
  details: Record<string, unknown>;
  timestamp: admin.firestore.Timestamp;
  ipAddress: string | null;
}

/**
 * Write an audit log entry for roster import actions.
 */
async function writeAuditLog(
  entry: Omit<AuditLogEntry, "logId" | "timestamp">
): Promise<void> {
  const db = admin.firestore();
  const logRef = db.collection("admin").doc("auditLogs").collection("entries").doc();

  const fullEntry: AuditLogEntry = {
    ...entry,
    logId: logRef.id,
    timestamp: admin.firestore.Timestamp.now(),
  };

  await logRef.set(fullEntry);
  functions.logger.info("Audit log written", {
    logId: fullEntry.logId,
    action: entry.action,
  });
}

/**
 * Required CSV columns for roster import
 */
const REQUIRED_COLUMNS = [
  "firstName",
  "lastName",
  "dob",
  "gender",
  "category",
  "declaredWeight",
];

/**
 * Validate CSV headers against required columns
 */
function validateHeaders(headers: string[]): string[] {
  const missing = REQUIRED_COLUMNS.filter(
    (col) => !headers.includes(col)
  );
  return missing;
}

/**
 * Parse date string in YYYY-MM-DD format to Timestamp
 */
function parseDateToTimestamp(dateStr: string): admin.firestore.Timestamp | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10)
  );

  // Validate date is real (e.g., not Feb 30)
  if (
    date.getFullYear() !== parseInt(year, 10) ||
    date.getMonth() !== parseInt(month, 10) - 1 ||
    date.getDate() !== parseInt(day, 10)
  ) {
    return null;
  }

  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Validate and parse a single CSV row into a Boxer document
 */
function parseRow(
  row: RosterCsvRow,
  rowIndex: number,
  userId: string,
  now: admin.firestore.Timestamp
): { boxer: Boxer | null; error: RosterImportError | null } {
  const errors: string[] = [];

  // Validate required fields
  if (!row.firstName?.trim()) {
    errors.push("firstName is required");
  }
  if (!row.lastName?.trim()) {
    errors.push("lastName is required");
  }
  if (!row.dob?.trim()) {
    errors.push("dob is required");
  }
  if (!row.gender?.trim()) {
    errors.push("gender is required");
  }
  if (!row.category?.trim()) {
    errors.push("category is required");
  }
  if (!row.declaredWeight?.trim()) {
    errors.push("declaredWeight is required");
  }

  if (errors.length > 0) {
    return {
      boxer: null,
      error: { row: rowIndex, message: errors.join("; ") },
    };
  }

  // Parse DOB
  const dob = parseDateToTimestamp(row.dob.trim());
  if (!dob) {
    return {
      boxer: null,
      error: { row: rowIndex, message: "Invalid dob format. Expected YYYY-MM-DD" },
    };
  }

  // Validate gender
  const gender = row.gender.trim().toLowerCase();
  if (gender !== "male" && gender !== "female") {
    return {
      boxer: null,
      error: { row: rowIndex, message: "gender must be 'male' or 'female'" },
    };
  }

  // Parse weight
  const weight = parseFloat(row.declaredWeight.trim());
  if (isNaN(weight) || weight <= 0) {
    return {
      boxer: null,
      error: { row: rowIndex, message: "declaredWeight must be a positive number" },
    };
  }

  // Parse optional numeric fields
  const declaredBouts = row.declaredBouts
    ? parseInt(row.declaredBouts.trim(), 10)
    : 0;
  const declaredWins = row.declaredWins
    ? parseInt(row.declaredWins.trim(), 10)
    : 0;
  const declaredLosses = row.declaredLosses
    ? parseInt(row.declaredLosses.trim(), 10)
    : 0;

  if (isNaN(declaredBouts) || declaredBouts < 0) {
    return {
      boxer: null,
      error: { row: rowIndex, message: "declaredBouts must be a non-negative integer" },
    };
  }
  if (isNaN(declaredWins) || declaredWins < 0) {
    return {
      boxer: null,
      error: { row: rowIndex, message: "declaredWins must be a non-negative integer" },
    };
  }
  if (isNaN(declaredLosses) || declaredLosses < 0) {
    return {
      boxer: null,
      error: { row: rowIndex, message: "declaredLosses must be a non-negative integer" },
    };
  }

  // Parse optional availability
  let availability: BoxerAvailability = "available";
  if (row.availability?.trim()) {
    const avail = row.availability.trim().toLowerCase();
    if (avail === "available" || avail === "unavailable" || avail === "injured") {
      availability = avail as BoxerAvailability;
    } else {
      return {
        boxer: null,
        error: {
          row: rowIndex,
          message: "availability must be 'available', 'unavailable', or 'injured'",
        },
      };
    }
  }

  // Create boxer document
  const boxer: Boxer = {
    boxerId: uuidv4(),
    firstName: row.firstName.trim(),
    lastName: row.lastName.trim(),
    dob,
    gender: gender as BoxerGender,
    category: row.category.trim(),
    declaredWeight: weight,
    declaredBouts,
    declaredWins,
    declaredLosses,
    dataStatus: "draft",
    availability,
    notes: row.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    lastModifiedBy: userId,
  };

  return { boxer, error: null };
}

/**
 * Storage trigger for CSV roster uploads.
 *
 * Triggered when a file is uploaded to: clubs/{clubId}/rosters/{fileName}
 * Expected fileName format: {importId}.csv
 *
 * Processing steps:
 * 1. Extract clubId from path
 * 2. Find rosterImport document by fileName
 * 3. Update status to 'processing'
 * 4. Download and parse CSV
 * 5. Create boxer documents with dataStatus='draft'
 * 6. Update rosterImport with results
 * 7. Write audit log
 */
export const processRosterUpload = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath) {
      functions.logger.warn("No file path in storage event");
      return;
    }

    // Check if this is a roster upload (clubs/{clubId}/rosters/{fileName})
    const pathMatch = filePath.match(/^clubs\/([^/]+)\/rosters\/(.+)$/);
    if (!pathMatch) {
      functions.logger.info("Not a roster upload, skipping", { filePath });
      return;
    }

    const [, clubId, fileName] = pathMatch;
    const contentType = object.contentType;

    // Verify it's a CSV file
    if (contentType !== "text/csv") {
      functions.logger.warn("Non-CSV file uploaded to rosters", {
        filePath,
        contentType,
      });
      return;
    }

    functions.logger.info("Processing roster upload", {
      clubId,
      fileName,
      contentType,
    });

    const db = admin.firestore();
    const storage = admin.storage();
    const now = admin.firestore.Timestamp.now();

    // Extract importId from fileName (expected: {importId}.csv)
    const importId = fileName.replace(/\.csv$/i, "");

    // Find the rosterImport document
    const importRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("rosterImports")
      .doc(importId);

    try {
      const importDoc = await importRef.get();

      if (!importDoc.exists) {
        functions.logger.error("RosterImport document not found", {
          clubId,
          importId,
        });
        return;
      }

      const importData = importDoc.data() as RosterImport;
      const uploadedBy = importData.uploadedBy;

      // Update status to processing
      await importRef.update({
        status: "processing",
      });

      // Download CSV file
      const bucket = storage.bucket(object.bucket);
      const file = bucket.file(filePath);
      const [contents] = await file.download();
      const csvContent = contents.toString("utf-8");

      // Parse CSV - first get headers, then parse with columns
      let headers: string[] = [];
      let records: RosterCsvRow[];
      try {
        // Parse without columns first to get header row
        const rawRecords = parse(csvContent, {
          skip_empty_lines: true,
          trim: true,
        }) as string[][];

        if (rawRecords.length === 0) {
          // Completely empty CSV
          await importRef.update({
            status: "completed",
            boxersCreated: 0,
            errors: [],
            processedAt: now,
          });
          return;
        }

        headers = rawRecords[0];

        // Now parse with columns for data rows
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch (parseError) {
        functions.logger.error("CSV parse failed", { error: parseError });
        await importRef.update({
          status: "failed",
          errors: [{ row: 0, message: "Malformed CSV file" }],
          processedAt: now,
        });
        return;
      }

      // Validate headers
      const missingHeaders = validateHeaders(headers);

      if (missingHeaders.length > 0) {
        functions.logger.error("Missing required CSV columns", { missingHeaders });
        await importRef.update({
          status: "failed",
          errors: [
            { row: 0, message: `Missing required columns: ${missingHeaders.join(", ")}` },
          ],
          processedAt: now,
        });
        return;
      }

      // Process rows
      const boxers: Boxer[] = [];
      const errors: RosterImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2; // +2 for 1-indexed and header row
        const result = parseRow(records[i], rowNumber, uploadedBy, now);

        if (result.boxer) {
          boxers.push(result.boxer);
        }
        if (result.error) {
          errors.push(result.error);
        }
      }

      // Create boxer documents using batched writes (max 500 per batch)
      const BATCH_SIZE = 500;
      const boxersRef = db.collection("clubs").doc(clubId).collection("boxers");

      for (let i = 0; i < boxers.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchBoxers = boxers.slice(i, i + BATCH_SIZE);

        for (const boxer of batchBoxers) {
          const boxerRef = boxersRef.doc(boxer.boxerId);
          batch.set(boxerRef, boxer);
        }

        await batch.commit();
        functions.logger.info("Boxer batch committed", {
          batchStart: i,
          batchSize: batchBoxers.length,
        });
      }

      // Update rosterImport with results
      const finalStatus = errors.length === records.length && records.length > 0
        ? "failed"
        : "completed";

      await importRef.update({
        status: finalStatus,
        boxersCreated: boxers.length,
        errors,
        processedAt: now,
      });

      functions.logger.info("Roster import completed", {
        clubId,
        importId,
        boxersCreated: boxers.length,
        errorsCount: errors.length,
        status: finalStatus,
      });

      // Write audit log
      await writeAuditLog({
        action: "roster.import.completed",
        actorId: uploadedBy,
        actorType: "user",
        targetType: "club",
        targetId: clubId,
        targetClubId: clubId,
        details: {
          importId,
          fileName,
          boxersCreated: boxers.length,
          errorsCount: errors.length,
          status: finalStatus,
        },
        ipAddress: null,
      });
    } catch (error) {
      functions.logger.error("Roster import failed", {
        error,
        clubId,
        importId,
      });

      // Try to update import status to failed
      try {
        await importRef.update({
          status: "failed",
          errors: [{ row: 0, message: "Internal processing error" }],
          processedAt: now,
        });
      } catch (updateError) {
        functions.logger.error("Failed to update import status", { updateError });
      }
    }
  });
