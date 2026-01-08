// Types matching backend FindMatch Cloud Function

export interface FindMatchRequest {
  naturalLanguageQuery: string;
  boxerId?: string;
  showDate?: string;
  options?: {
    limit?: number;
    excludeOwnClub?: boolean;
  };
}

export interface MatchCandidate {
  boxerId: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'male' | 'female';
  category: string;
  declaredWeight: number;
  declaredBouts: number;
  declaredWins: number;
  declaredLosses: number;
  availability: string;
  clubId: string;
  clubName: string;
  complianceScore: number;
  complianceNotes: string[];
}

export interface ParsedMatchIntent {
  boxerName?: string;
  boxerId?: string;
  weightRange?: { min: number; max: number };
  targetDate?: string;
  experienceLevel?: string;
}

export interface FindMatchResponse {
  success: boolean;
  matches: MatchCandidate[];
  explanation: string;
  parsedIntent: ParsedMatchIntent;
}

export type MessageRole = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  matches?: MatchCandidate[];
  timestamp: Date;
  isError?: boolean;
}

export type AIErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'resource-exhausted'
  | 'internal'
  | 'timeout'
  | 'network';

export interface AIError {
  code: AIErrorCode;
  message: string;
}
