import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import {
  InitiateRosterUploadRequest,
  InitiateRosterUploadResponse,
} from "../types/boxer";

/**
 * Story 4.1: Upload Draft Roster (CSV)
 *
 * Callable function to initiate a roster CSV upload.
 * Creates a pending rosterImport document and returns the storage path.
 *
 * The client then uploads the CSV to the returned storagePath,
 * which triggers processRosterUpload.
 */

/**
 * Callable function to initiate a roster upload.
 *
 * Security: Requires authentication and club membership.
 *
 * Actions:
 * 1. Verify caller is authenticated
 * 2. Verify caller is a member of the target club
 * 3. Create rosterImport document with status='pending'
 * 4. Return storagePath for client to upload CSV
 */
export const initiateRosterUpload = functions.https.onCall(
  async (
    data: InitiateRosterUploadRequest,
    context
  ): Promise<InitiateRosterUploadResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to initiate roster upload"
      );
    }

    const userId = context.auth.uid;

    // 2. Validate request data
    if (!data.clubId || typeof data.clubId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId is required and must be a string"
      );
    }

    const { clubId } = data;
    const db = admin.firestore();

    // 3. Verify caller is a member of the club
    const memberRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .doc(userId);

    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be a member of this club to upload a roster"
      );
    }

    // 4. Verify club exists and is claimed
    const clubRef = db.collection("clubs").doc(clubId);
    const clubDoc = await clubRef.get();

    if (!clubDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Club with id ${clubId} not found`
      );
    }

    const clubData = clubDoc.data();
    if (clubData?.status !== "claimed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Club must be claimed before uploading a roster"
      );
    }

    // 5. Generate import ID and storage path
    const importId = uuidv4();
    const fileName = `${importId}.csv`;
    const storagePath = `clubs/${clubId}/rosters/${fileName}`;

    const now = admin.firestore.Timestamp.now();

    // 6. Create rosterImport document with status='pending'
    const importRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("rosterImports")
      .doc(importId);

    await importRef.set({
      importId,
      fileName,
      storagePath,
      status: "pending",
      boxersCreated: 0,
      errors: [],
      uploadedBy: userId,
      uploadedAt: now,
      processedAt: null,
    });

    functions.logger.info("Roster upload initiated", {
      clubId,
      importId,
      userId,
      storagePath,
    });

    return {
      importId,
      storagePath,
    };
  }
);
