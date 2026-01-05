/**
 * Auth Trigger: onUserCreate
 *
 * Creates a user document in Firestore when a new Firebase Auth user is created.
 * This ensures every authenticated user has a corresponding Firestore profile.
 *
 * Story 1.1 - User Authentication
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * User document schema as defined in Firebase Implementation Plan §1.1
 */
interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  clubMemberships: string[]; // Array of clubIds (initially empty)
}

/**
 * Firebase Auth trigger that fires when a new user is created.
 * Creates the corresponding Firestore document at users/{userId}.
 *
 * Behavior:
 * - Extracts user info from UserRecord
 * - Creates Firestore doc with schema fields
 * - Initializes clubMemberships as empty array
 * - Handles errors gracefully (logs, doesn't throw)
 * - Idempotent: won't overwrite if doc already exists
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;

  const userDoc: UserDocument = {
    uid,
    email: email || "",
    displayName: displayName || "",
    photoURL: photoURL || null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    clubMemberships: [], // AC: 3 - User has no club access until claim or invite
  };

  try {
    const userRef = db.collection("users").doc(uid);

    // Check if doc already exists (idempotency)
    const existingDoc = await userRef.get();
    if (existingDoc.exists) {
      functions.logger.info(`User doc already exists for ${uid}, skipping creation`);
      return;
    }

    await userRef.set(userDoc);
    functions.logger.info(`Created user document for ${uid}`);
  } catch (error) {
    // Log error but don't throw - auth user creation should not fail
    functions.logger.error(`Failed to create user document for ${uid}:`, error);
  }
});
