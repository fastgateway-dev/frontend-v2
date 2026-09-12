'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { commentsApi, projectsApi } from '@/lib/api';
import type { ApprovalComment, User } from '@/types';

interface CommentFeedProps {
  projectId: string;
  approvalId: string;
}

export function CommentFeed({ projectId, approvalId }: CommentFeedProps) {
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // @mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const result = await commentsApi.list(projectId, approvalId);
      setComments(result.data || []);
      setTotal(result.total);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId, approvalId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Fetch mention suggestions
  useEffect(() => {
    if (!showMentions || !mentionSearch) {
      setMentionUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await projectsApi.listMembers(projectId, mentionSearch);
        setMentionUsers(users);
        setMentionIndex(0);
      } catch {
        setMentionUsers([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [showMentions, mentionSearch, projectId]);

  const handleInputChange = (value: string) => {
    setBody(value);

    // Detect @ trigger
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionSearch(atMatch[1]);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = body.slice(0, cursorPos);
    const textAfterCursor = body.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, atIndex) + '@' + username + ' ' + textAfterCursor;
    setBody(newText);
    setShowMentions(false);
    setMentionSearch('');
    textarea.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, mentionUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionUsers[mentionIndex].username);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setIsSubmitting(true);
    try {
      await commentsApi.create(projectId, approvalId, body.trim());
      setBody('');
      await fetchComments();
    } catch {
      // silently fail
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render comment body with @mentions highlighted
  const renderBody = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.match(/^@\w+$/)) {
        return (
          <span key={i} className="inline-block bg-primary-100 text-primary-700 rounded px-1 text-sm font-medium">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Discussion</h2>
          {total > 0 && (
            <span className="text-sm text-gray-500">({total})</span>
          )}
        </div>

        {/* Comments list */}
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No comments yet. Start the discussion.</p>
        ) : (
          <div className="space-y-4 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary-700">
                    {comment.user?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.user?.username || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                    {renderBody(comment.body)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            placeholder="Add a comment... Use @ to mention someone"
          />

          {/* @mention autocomplete dropdown */}
          {showMentions && mentionUsers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
              {mentionUsers.map((user, idx) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user.username)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                    idx === mentionIndex ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary-700">
                      {user.username[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span>{user.username}</span>
                  <span className="text-gray-400 text-xs ml-auto">{user.email}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-2">
            <Button
              onClick={handleSubmit}
              disabled={!body.trim() || isSubmitting}
              isLoading={isSubmitting}
            >
              <Send className="h-4 w-4 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
