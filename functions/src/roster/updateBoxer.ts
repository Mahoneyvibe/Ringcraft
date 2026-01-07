import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  UpdateBoxerRequest,
  UpdateBoxerResponse,
  Boxer,
  BoxerUpdates,
} from "../types/boxer";

/**
 * Story 4.3: Edit Boxer Profile
 *
 * Callable function for club members to update boxer details.
 * Only owning club members may edit. Updates record editor and timestamp.
 *
 * Immutable fields: boxerId, createdAt, createdBy
 * Auto-set fields: updatedAt, lastModifiedBy
 */

// Fields that cannot be modified by the client
const IMMUTABLE_FIELDS = ["boxerId", "createdAt", "createdBy"];

// Fields that are auto-set by the function
const AUTO_SET_FIELDS = ["updatedAt", "lastModifiedBy"];

// Valid editable fields
const EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "dob",
  "gender",
  "category",
  "declaredWeight",
  "declaredBouts",
  "declaredWins",
  "declaredLosses",
  "dataStatus",
  "availability",
  "notes",
];

/**
 * Validate that the updates object only contains valid editable fields
 */
function validateUpdates(updates: Record<string, unknown>): void {
  const providedFields = Object.keys(updates);

  // Check for immutable fields
  for (const field of IMMUTABLE_FIELDS) {
    if (field in updates) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Cannot modify immutable field: ${field}`
      );
    }
  }

  // Check for auto-set fields
  for (const field of AUTO_SET_FIELDS) {
    if (field in updates) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Cannot modify auto-set field: ${field}`
      );
    }
  }

  // Check that all provided fields are valid
  for (const field of providedFields) {
    if (!EDITABLE_FIELDS.includes(field)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unknown field: ${field}`
      );
    }
  }
}

/**
 * Validate field types for the updates
 */
function validateFieldTypes(updates: BoxerUpdates): void {
  if (updates.firstName !== undefined && typeof updates.firstName !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "firstName must be a string"
    );
  }

  if (updates.lastName !== undefined && typeof updates.lastName !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "lastName must be a string"
    );
  }

  if (updates.dob !== undefined && typeof updates.dob !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "dob must be a string in ISO format"
    );
  }

  if (updates.gender !== undefined && !["male", "female"].includes(updates.gender)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "gender must be 'male' or 'female'"
    );
  }

  if (updates.category !== undefined && typeof updates.category !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "category must be a string"
    );
  }

  if (updates.declaredWeight !== undefined && typeof updates.declaredWeight !== "number") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "declaredWeight must be a number"
    );
  }

  if (updates.declaredBouts !== undefined && typeof updates.declaredBouts !== "number") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "declaredBouts must be a number"
    );
  }

  if (updates.declaredWins !== undefined && typeof updates.declaredWins !== "number") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "declaredWins must be a number"
    );
  }

  if (updates.declaredLosses !== undefined && typeof updates.declaredLosses !== "number") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "declaredLosses must be a number"
    );
  }

  if (
    updates.dataStatus !== undefined &&
    !["draft", "active", "archived"].includes(updates.dataStatus)
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "dataStatus must be 'draft', 'active', or 'archived'"
    );
  }

  if (
    updates.availability !== undefined &&
    !["available", "unavailable", "injured"].includes(updates.availability)
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "availability must be 'available', 'unavailable', or 'injured'"
    );
  }

  if (
    updates.notes !== undefined &&
    updates.notes !== null &&
    typeof updates.notes !== "string"
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "notes must be a string or null"
    );
  }
}

/**
 * Callable function to update boxer details.
 *
 * Security: Requires authentication and club membership.
 *
 * Actions:
 * 1. Verify caller is authenticated
 * 2. Verify caller is a member of the target club
 * 3. Verify boxer exists and belongs to club
 * 4. Validate editable fields
 * 5. Update boxer with provided fields
 * 6. Set updatedAt and lastModifiedBy
 * 7. Return updated boxer data
 */
export const updateBoxer = functions.https.onCall(
  async (data: UpdateBoxerRequest, context): Promise<UpdateBoxerResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to update boxer"
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

    if (!data.boxerId || typeof data.boxerId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "boxerId is required and must be a string"
      );
    }

    if (!data.updates || typeof data.updates !== "object") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "updates is required and must be an object"
      );
    }

    // Check for empty updates
    const updateKeys = Object.keys(data.updates);
    if (updateKeys.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "updates object cannot be empty. At least one field must be provided."
      );
    }

    const { clubId, boxerId, updates } = data;
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
        "You must be a member of this club to update boxers"
      );
    }

    // 4. Verify boxer exists and belongs to club
    const boxerRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("boxers")
      .doc(boxerId);

    const boxerDoc = await boxerRef.get();

    if (!boxerDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Boxer with id ${boxerId} not found in club ${clubId}`
      );
    }

    // 5. Validate updates
    validateUpdates(updates as Record<string, unknown>);
    validateFieldTypes(updates);

    // 6. Build the update object
    const now = admin.firestore.Timestamp.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      ...updates,
      updatedAt: now,
      lastModifiedBy: userId,
    };

    // Convert dob string to Timestamp if provided
    if (updates.dob) {
      const dobDate = new Date(updates.dob);
      if (isNaN(dobDate.getTime())) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "dob must be a valid date string"
        );
      }
      updateData.dob = admin.firestore.Timestamp.fromDate(dobDate);
    }

    try {
      // 7. Update the boxer
      await boxerRef.update(updateData);

      // 8. Get the updated boxer data
      const updatedBoxerDoc = await boxerRef.get();
      const updatedBoxer = updatedBoxerDoc.data() as Boxer;

      functions.logger.info("Boxer updated", {
        clubId,
        boxerId,
        userId,
        updatedFields: updateKeys,
      });

      return {
        success: true,
        boxer: updatedBoxer,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to update boxer", {
        error,
        clubId,
        boxerId,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update boxer"
      );
    }
  }
);
