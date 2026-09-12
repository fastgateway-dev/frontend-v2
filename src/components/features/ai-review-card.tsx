'use client';

import { AlertTriangle, Info, Shield, Lightbulb, List, Sparkles } from 'lucide-react';
import { Card, CardContent, Badge } from '@/components/ui';
import type { AIReviewResult, AIReviewNote } from '@/types';

interface AIReviewCardProps {
  review: AIReviewResult;
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'warning') {
    return (
      <Badge variant="warning" className="text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="info" className="text-xs">
      <Info className="h-3 w-3 mr-1" />
      Info
    </Badge>
  );
}

function NotesList({ notes, icon: Icon, title }: { notes: AIReviewNote[]; icon: React.ElementType; title: string }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="space-y-2">
        {notes.map((note, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <SeverityBadge severity={note.severity} />
            <span className="text-gray-600">{note.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIReviewCard({ review }: AIReviewCardProps) {
  const hasRisks = review.risks && review.risks.length > 0;
  const hasSecurityNotes = review.securityNotes && review.securityNotes.length > 0;
  const hasSuggestions = review.suggestions && review.suggestions.length > 0;
  const hasHighlights = review.configHighlights && review.configHighlights.length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900">AI Review</h3>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700">{review.summary}</p>
          </div>

          {hasRisks && (
            <NotesList notes={review.risks!} icon={AlertTriangle} title="Risks" />
          )}

          {hasSecurityNotes && (
            <NotesList notes={review.securityNotes!} icon={Shield} title="Security Notes" />
          )}

          {hasSuggestions && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-4 w-4" />
                Suggestions
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {review.suggestions!.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {hasHighlights && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <List className="h-4 w-4" />
                Configuration
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {review.configHighlights!.map((h, i) => (
                  <li key={i} className="text-sm text-gray-600">{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
