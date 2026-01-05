import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

/**
 * Story 2.1 Seed Script: Pre-Seed Club Directory
 *
 * Seeds the clubs collection with sample UK amateur boxing clubs.
 * All clubs are created with status='unclaimed' ready for club officials to claim.
 *
 * SAFETY GUARDS:
 * 1. When FIRESTORE_EMULATOR_HOST is set, runs against emulator (safe)
 * 2. When running against production, requires --confirm flag
 *
 * IDEMPOTENCY:
 * - Skips clubs that already exist (checks by clubId)
 * - Safe to run multiple times
 *
 * USAGE:
 *   # Emulator (safe - auto-allowed):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-clubs.ts
 *
 *   # Production (requires confirmation):
 *   npx ts-node scripts/seed-clubs.ts --confirm
 *
 * EXAMPLES:
 *   # Seed clubs in emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-clubs.ts
 *
 *   # Seed clubs in production (DANGEROUS):
 *   npx ts-node scripts/seed-clubs.ts --confirm
 */

interface SeedClub {
  clubId: string;
  name: string;
  region: string;
  status: string;
  claimedBy: string | null;
  claimedAt: admin.firestore.Timestamp | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface SeedData {
  clubs: SeedClub[];
}

async function seedClubs() {
  const args = process.argv.slice(2);
  const hasConfirmFlag = args.includes("--confirm");
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  // 1. Safety guard for production
  if (!isEmulator && !hasConfirmFlag) {
    console.error("CRITICAL ERROR: Running against PRODUCTION without confirmation.");
    console.error("");
    console.error("If you really want to seed clubs in production, add --confirm:");
    console.error("  npx ts-node scripts/seed-clubs.ts --confirm");
    console.error("");
    console.error("For local development, use the emulator:");
    console.error("  FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-clubs.ts");
    process.exit(1);
  }

  // 2. Log environment
  if (isEmulator) {
    console.log(`Running against EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    console.log("WARNING: Running against PRODUCTION");
  }

  // 3. Initialize Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "firstbell-dev",
    });
  }

  // 4. Load seed data
  const seedDataPath = path.join(__dirname, "../data/seed-clubs.json");
  console.log(`Loading seed data from: ${seedDataPath}`);

  if (!fs.existsSync(seedDataPath)) {
    console.error(`ERROR: Seed data file not found at ${seedDataPath}`);
    process.exit(1);
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedDataPath, "utf-8"));
  console.log(`Found ${seedData.clubs.length} clubs to seed`);

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // 5. Seed each club (idempotent)
  for (const club of seedData.clubs) {
    const clubRef = db.collection("clubs").doc(club.clubId);

    try {
      const existing = await clubRef.get();

      if (existing.exists) {
        console.log(`  SKIP: ${club.name} (${club.clubId}) - already exists`);
        skipped++;
        continue;
      }

      await clubRef.set({
        clubId: club.clubId,
        name: club.name,
        region: club.region,
        status: club.status,
        claimedBy: club.claimedBy,
        claimedAt: club.claimedAt,
        contactEmail: club.contactEmail,
        contactPhone: club.contactPhone,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`  CREATE: ${club.name} (${club.clubId})`);
      created++;
    } catch (error) {
      console.error(`  ERROR: ${club.name} (${club.clubId}):`, error);
      errors++;
    }
  }

  // 6. Summary
  console.log("");
  console.log("SEED COMPLETE");
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log("");

  if (isEmulator) {
    console.log("Emulator verification:");
    console.log("1. Open Firebase Emulator UI: http://localhost:4000");
    console.log("2. Check Firestore > clubs collection");
  }

  process.exit(errors > 0 ? 1 : 0);
}

seedClubs();
