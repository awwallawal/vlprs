import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAnnotations, useAddAnnotation } from '@/hooks/useAnnotations';
import { useAuthStore } from '@/stores/authStore';
import { UI_COPY } from '@vlprs/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/formatters';

export function LoanAnnotations({ loanId }: { loanId: string }) {
  const { data: annotations, isLoading, isError } = useAnnotations(loanId);
  const addMutation = useAddAnnotation(loanId);
  const user = useAuthStore((s) => s.user);
  const canAdd = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const [content, setContent] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) return;
    addMutation.mutate(
      { content: content.trim() },
      {
        onSuccess: () => {
          toast.success(UI_COPY.ANNOTATION_ADDED);
          setContent('');
          setShowForm(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <section aria-label="Annotations" className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">{UI_COPY.ANNOTATIONS_HEADER}</h3>
        </div>
        {canAdd && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Add Annotation
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 space-y-2">
          <Textarea
            placeholder={UI_COPY.ADD_ANNOTATION_PROMPT}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{content.length}/2000</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setContent(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-text-muted">Unable to load annotations.</p>
      )}

      {!isLoading && !isError && annotations?.length === 0 && (
        <p className="text-sm text-text-muted">{UI_COPY.NO_ANNOTATIONS_YET}</p>
      )}

      {annotations && annotations.length > 0 && (
        <div className="space-y-3">
          {annotations.map((a) => (
            <div key={a.id} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="font-medium text-text-secondary">{a.createdBy.name}</span>
                <span title={new Date(a.createdAt).toLocaleString()}>{timeAgo(a.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
