import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchCandidate } from '@/types/ai';

interface MatchCardProps {
  match: MatchCandidate;
  className?: string;
}

export function MatchCard({ match, className }: MatchCardProps) {
  const hasWarnings = match.complianceNotes.length > 0;
  const isCompliant = match.complianceScore >= 80;

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-neutral-300 p-3 shadow-sm',
        className
      )}
    >
      {/* Header: Name and Club */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-neutral-900">
            {match.firstName} {match.lastName}
          </h4>
          <p className="text-sm text-neutral-600">{match.clubName}</p>
        </div>
        {/* Compliance indicator */}
        <div
          className={cn(
            'flex-shrink-0 p-1 rounded-full',
            isCompliant ? 'text-success' : 'text-warning'
          )}
          title={isCompliant ? 'Compliant match' : 'Review compliance notes'}
        >
          {isCompliant ? (
            <Check className="h-4 w-4" aria-label="Compliant" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-label="Has warnings" />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-2 flex items-center gap-3 text-sm text-neutral-600">
        <span>{match.declaredWeight}kg</span>
        <span className="text-neutral-300">•</span>
        <span>
          {match.declaredWins}W-{match.declaredLosses}L
        </span>
        <span className="text-neutral-300">•</span>
        <span>Age {match.age}</span>
      </div>

      {/* Compliance warnings */}
      {hasWarnings && (
        <div className="mt-2 text-xs text-warning">
          {match.complianceNotes.map((note, i) => (
            <p key={i}>⚠ {note}</p>
          ))}
        </div>
      )}

      {/* Action button (disabled) */}
      <button
        className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-md bg-primary/10 text-primary opacity-50 cursor-not-allowed"
        disabled
        title="Coming in a future update"
        type="button"
      >
        Send Proposal
      </button>
    </div>
  );
}
