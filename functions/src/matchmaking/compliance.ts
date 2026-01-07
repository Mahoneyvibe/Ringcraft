import { Timestamp } from "firebase-admin/firestore";
import { BoxerSearchResult } from "../types/discovery";
import {
  ComplianceResult,
  ComplianceCheckResult,
  ComplianceIssue,
  ComplianceWarning,
  DEFAULT_COMPLIANCE_RULES,
} from "../types/matchmaking";

/**
 * Story 6.1 - Compliance Filtering Module
 *
 * Computes compliance between two boxers at runtime.
 * All compliance data is DERIVED, never persisted.
 *
 * Invariants:
 * - Age is calculated from DOB + show date
 * - Compliance flags are never stored in Firestore
 * - Rules are configurable but default to EB guidelines
 */

// ═══════════════════════════════════════════
// AGE CALCULATION
// ═══════════════════════════════════════════

/**
 * Calculate age at a specific date
 *
 * Age is ALWAYS computed, never stored.
 *
 * @param dob - Date of birth (Firestore Timestamp)
 * @param targetDate - Date to calculate age at (e.g., show date)
 * @returns Age in years
 */
export function calculateAgeAtDate(dob: Timestamp, targetDate: Date): number {
  const birthDate = dob.toDate();
  let age = targetDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = targetDate.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && targetDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

// ═══════════════════════════════════════════
// COMPLIANCE CHECKS
// ═══════════════════════════════════════════

/**
 * Check age compliance between two boxers
 *
 * Rules:
 * - Same category required
 * - Age difference within category limits
 *
 * @param sourceAge - Age of source boxer
 * @param targetAge - Age of target boxer
 * @param category - Boxing category
 * @returns Compliance check result
 */
export function checkAgeCompliance(
  sourceAge: number,
  targetAge: number,
  category: string
): ComplianceCheckResult {
  const ageRanges = DEFAULT_COMPLIANCE_RULES.ageRanges;
  const difference = Math.abs(sourceAge - targetAge);

  // Get category limits
  let categoryRange: { min: number; max: number };
  let maxAgeDifference: number;

  switch (category.toLowerCase()) {
    case "junior":
      categoryRange = ageRanges.junior;
      maxAgeDifference = 2; // Juniors: max 2 year difference
      break;
    case "youth":
      categoryRange = ageRanges.youth;
      maxAgeDifference = 2; // Youth: max 2 year difference
      break;
    case "elite":
    default:
      categoryRange = ageRanges.elite;
      maxAgeDifference = 5; // Elite: max 5 year difference for fair matching
      break;
  }

  // Check if both boxers are within category age range
  const sourceInRange =
    sourceAge >= categoryRange.min && sourceAge <= categoryRange.max;
  const targetInRange =
    targetAge >= categoryRange.min && targetAge <= categoryRange.max;

  // Check if age difference is acceptable
  const differenceOk = difference <= maxAgeDifference;

  const passed = sourceInRange && targetInRange && differenceOk;

  // Calculate score (100 = perfect, decreases with age difference)
  let score = 100;
  if (!sourceInRange || !targetInRange) {
    score = 0; // Out of category = 0
  } else {
    // Decrease score based on age difference (10 points per year)
    score = Math.max(0, 100 - difference * 10);
  }

  let details: string;
  if (!sourceInRange) {
    details = `Source boxer age ${sourceAge} is outside ${category} range (${categoryRange.min}-${categoryRange.max})`;
  } else if (!targetInRange) {
    details = `Target boxer age ${targetAge} is outside ${category} range (${categoryRange.min}-${categoryRange.max})`;
  } else if (!differenceOk) {
    details = `Age difference of ${difference} years exceeds maximum of ${maxAgeDifference} for ${category}`;
  } else {
    details = `Age difference of ${difference} years is within ${category} limits`;
  }

  return {
    passed,
    score,
    details,
    sourceValue: sourceAge,
    targetValue: targetAge,
    difference,
    tolerance: maxAgeDifference,
  };
}

/**
 * Check weight compliance between two boxers
 *
 * Rules:
 * - Weight difference within tolerance
 * - Tolerance varies by weight class
 *
 * @param sourceWeight - Weight of source boxer in kg
 * @param targetWeight - Weight of target boxer in kg
 * @param category - Boxing category
 * @returns Compliance check result
 */
export function checkWeightCompliance(
  sourceWeight: number,
  targetWeight: number,
  category: string
): ComplianceCheckResult {
  const tolerances = DEFAULT_COMPLIANCE_RULES.weightTolerances;
  const difference = Math.abs(sourceWeight - targetWeight);

  // Determine weight class and tolerance
  let tolerance: number;
  let weightClass: string;

  if (sourceWeight < 60) {
    tolerance = tolerances.light;
    weightClass = "light";
  } else if (sourceWeight <= 75) {
    tolerance = tolerances.medium;
    weightClass = "medium";
  } else {
    tolerance = tolerances.heavy;
    weightClass = "heavy";
  }

  const passed = difference <= tolerance;

  // Calculate score (100 = exact match, decreases with difference)
  let score: number;
  if (difference === 0) {
    score = 100;
  } else if (passed) {
    // Within tolerance: 60-100 based on how close
    score = Math.round(100 - (difference / tolerance) * 40);
  } else {
    // Over tolerance: 0-60 based on how far over
    const overBy = difference - tolerance;
    score = Math.max(0, Math.round(60 - overBy * 20));
  }

  const details = passed
    ? `Weight difference of ${difference.toFixed(1)}kg is within ${tolerance}kg tolerance for ${weightClass} weight class`
    : `Weight difference of ${difference.toFixed(1)}kg exceeds ${tolerance}kg tolerance for ${weightClass} weight class`;

  return {
    passed,
    score,
    details,
    sourceValue: sourceWeight,
    targetValue: targetWeight,
    difference,
    tolerance,
  };
}

/**
 * Check experience compliance between two boxers
 *
 * Rules:
 * - Bout count difference within tolerance
 * - Tolerance varies by experience level
 *
 * @param sourceBouts - Total bouts of source boxer
 * @param targetBouts - Total bouts of target boxer
 * @returns Compliance check result
 */
export function checkExperienceCompliance(
  sourceBouts: number,
  targetBouts: number
): ComplianceCheckResult {
  const tolerances = DEFAULT_COMPLIANCE_RULES.experienceTolerances;
  const difference = Math.abs(sourceBouts - targetBouts);

  // Determine experience level and tolerance based on source boxer
  let tolerance: number;
  let experienceLevel: string;

  if (sourceBouts <= 5) {
    tolerance = tolerances.novice;
    experienceLevel = "novice";
  } else if (sourceBouts <= 15) {
    tolerance = tolerances.intermediate;
    experienceLevel = "intermediate";
  } else {
    tolerance = tolerances.experienced;
    experienceLevel = "experienced";
  }

  const passed = difference <= tolerance;

  // Calculate score (100 = equal experience, decreases with difference)
  let score: number;
  if (difference === 0) {
    score = 100;
  } else if (passed) {
    // Within tolerance: 70-100
    score = Math.round(100 - (difference / tolerance) * 30);
  } else {
    // Over tolerance: 0-70
    const overBy = difference - tolerance;
    score = Math.max(0, Math.round(70 - overBy * 15));
  }

  const details = passed
    ? `Experience difference of ${difference} bouts is within ${tolerance} bout tolerance for ${experienceLevel} boxers`
    : `Experience difference of ${difference} bouts exceeds ${tolerance} bout tolerance for ${experienceLevel} boxers`;

  return {
    passed,
    score,
    details,
    sourceValue: sourceBouts,
    targetValue: targetBouts,
    difference,
    tolerance,
  };
}

// ═══════════════════════════════════════════
// COMBINED COMPLIANCE EVALUATION
// ═══════════════════════════════════════════

/**
 * Evaluate full compliance between two boxers
 *
 * Combines age, weight, and experience checks.
 * Returns overall compliance result with score.
 *
 * @param source - Source boxer (the one looking for a match)
 * @param target - Target boxer (potential opponent)
 * @param showDate - Date of the show (for age calculation)
 * @returns Full compliance result
 */
export function evaluateMatchCompliance(
  source: BoxerSearchResult,
  target: BoxerSearchResult,
  showDate: Date
): ComplianceResult {
  const issues: ComplianceIssue[] = [];
  const warnings: ComplianceWarning[] = [];

  // Calculate ages at show date
  const sourceAge = calculateAgeAtDate(source.dob, showDate);
  const targetAge = calculateAgeAtDate(target.dob, showDate);

  // Run compliance checks
  const ageCheck = checkAgeCompliance(sourceAge, targetAge, source.category);
  const weightCheck = checkWeightCompliance(
    source.declaredWeight,
    target.declaredWeight,
    source.category
  );
  const experienceCheck = checkExperienceCompliance(
    source.declaredBouts,
    target.declaredBouts
  );

  // Collect issues from failed checks
  if (!ageCheck.passed) {
    issues.push({
      type: "age",
      severity: "high",
      message: ageCheck.details,
    });
  }

  if (!weightCheck.passed) {
    issues.push({
      type: "weight",
      severity: "high",
      message: weightCheck.details,
    });
  }

  if (!experienceCheck.passed) {
    issues.push({
      type: "experience",
      severity: "medium",
      message: experienceCheck.details,
    });
  }

  // Check category mismatch
  if (source.category.toLowerCase() !== target.category.toLowerCase()) {
    issues.push({
      type: "category",
      severity: "high",
      message: `Category mismatch: ${source.category} vs ${target.category}`,
    });
  }

  // Check gender mismatch (implicit in same-category search, but be explicit)
  if (source.gender !== target.gender) {
    issues.push({
      type: "category",
      severity: "high",
      message: `Gender mismatch: ${source.gender} vs ${target.gender}`,
    });
  }

  // Check availability
  if (target.availability !== "available") {
    issues.push({
      type: "availability",
      severity: "high",
      message: `Target boxer is ${target.availability}`,
    });
  }

  // Add warnings for edge cases (passed but worth noting)
  if (ageCheck.passed && ageCheck.difference >= 3) {
    warnings.push({
      type: "age",
      message: `Age difference of ${ageCheck.difference} years is significant`,
    });
  }

  if (weightCheck.passed && weightCheck.difference > 1) {
    warnings.push({
      type: "weight",
      message: `Weight difference of ${weightCheck.difference.toFixed(1)}kg - consider weigh-in verification`,
    });
  }

  if (experienceCheck.passed && experienceCheck.difference >= 3) {
    warnings.push({
      type: "experience",
      message: `Experience difference of ${experienceCheck.difference} bouts - check records`,
    });
  }

  // Check win/loss record disparity
  const sourceWinRate =
    source.declaredBouts > 0
      ? source.declaredWins / source.declaredBouts
      : 0.5;
  const targetWinRate =
    target.declaredBouts > 0
      ? target.declaredWins / target.declaredBouts
      : 0.5;
  const winRateDiff = Math.abs(sourceWinRate - targetWinRate);

  if (winRateDiff > 0.3 && source.declaredBouts >= 5 && target.declaredBouts >= 5) {
    warnings.push({
      type: "record",
      message: `Significant win rate difference (${Math.round(sourceWinRate * 100)}% vs ${Math.round(targetWinRate * 100)}%)`,
    });
  }

  // Calculate overall score (weighted average)
  // Weight: 30%, Age: 35%, Experience: 35%
  const overallScore = Math.round(
    weightCheck.score * 0.3 + ageCheck.score * 0.35 + experienceCheck.score * 0.35
  );

  // Determine overall compliance
  // Must pass all high-severity checks
  const isCompliant = issues.filter((i) => i.severity === "high").length === 0;

  return {
    isCompliant,
    score: overallScore,
    issues,
    warnings,
    checks: {
      age: ageCheck,
      weight: weightCheck,
      experience: experienceCheck,
    },
  };
}

/**
 * Generate human-readable compliance notes from a result
 *
 * @param result - Compliance result
 * @returns Array of human-readable notes
 */
export function generateComplianceNotes(result: ComplianceResult): string[] {
  const notes: string[] = [];

  if (result.isCompliant) {
    notes.push(`Compliance score: ${result.score}/100`);

    // Add positive notes
    if (result.checks.weight.score >= 90) {
      notes.push("Excellent weight match");
    }
    if (result.checks.age.score >= 90) {
      notes.push("Excellent age match");
    }
    if (result.checks.experience.score >= 90) {
      notes.push("Similar experience levels");
    }

    // Add warnings
    for (const warning of result.warnings) {
      notes.push(`Note: ${warning.message}`);
    }
  } else {
    notes.push("Non-compliant match");
    for (const issue of result.issues) {
      notes.push(`Issue: ${issue.message}`);
    }
  }

  return notes;
}
