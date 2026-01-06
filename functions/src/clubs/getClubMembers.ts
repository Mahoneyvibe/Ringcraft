import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  ClubMember,
  ClubMemberListItem,
  GetClubMembersRequest,
  GetClubMembersResponse,
} from "../types/club";

/**
 * Story 3.2: View Club Members
 *
 * Callable function to get all members of a club.
 * Any authenticated user can view any club's members (directory browsing).
 *
 * Security: Requires authentication only.
 * Privacy: Returns public member data (displayName, photoURL, role, joinedAt).
 */

/**
 * Transform ClubMember document to ClubMemberListItem (public-facing data)
 */
function toMemberListItem(member: ClubMember): ClubMemberListItem {
  return {
    userId: member.userId,
    displayName: member.displayName,
    photoURL: member.photoURL,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

/**
 * Callable function to get club members.
 *
 * Security: Requires authentication.
 *
 * @param data.clubId - The club ID to get members for
 * @returns List of club members (public fields only)
 */
export const getClubMembers = functions.https.onCall(
  async (data: GetClubMembersRequest, context): Promise<GetClubMembersResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to view club members"
      );
    }

    // 2. Validate request data
    if (!data?.clubId || typeof data.clubId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId is required and must be a string"
      );
    }

    const clubId = data.clubId.trim();
    if (!clubId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId cannot be empty"
      );
    }

    functions.logger.info("Get club members requested", {
      userId: context.auth.uid,
      clubId,
    });

    try {
      const db = admin.firestore();

      // 3. Verify club exists
      const clubDoc = await db.collection("clubs").doc(clubId).get();
      if (!clubDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Club with id ${clubId} not found`
        );
      }

      // 4. Query members subcollection
      const membersSnapshot = await db
        .collection("clubs")
        .doc(clubId)
        .collection("members")
        .get();

      // 5. Transform to public-facing data
      const members: ClubMemberListItem[] = membersSnapshot.docs.map((doc) => {
        const memberData = doc.data() as ClubMember;
        return toMemberListItem(memberData);
      });

      functions.logger.info("Get club members completed", {
        userId: context.auth.uid,
        clubId,
        memberCount: members.length,
      });

      return {
        members,
        total: members.length,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to get club members", { error, clubId });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to get club members"
      );
    }
  }
);
