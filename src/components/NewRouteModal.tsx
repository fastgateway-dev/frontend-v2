'use client';

import { useRouter } from 'next/navigation';
import { Pencil, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface NewRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  domainId: string;
}

export function NewRouteModal({ isOpen, onClose, projectId, domainId }: NewRouteModalProps) {
  const router = useRouter();

  const goManual = () => {
    onClose();
    router.push(`/projects/${projectId}/domains/${domainId}/routes/create`);
  };

  const goNL = () => {
    onClose();
    router.push(`/projects/${projectId}/domains/${domainId}/routes/create?mode=nl`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Route" size="lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          data-testid="new-route-card-manual"
          onClick={goManual}
          className="text-left rounded-lg border bg-white p-4 hover:border-indigo-500 hover:shadow transition"
        >
          <Pencil className="h-5 w-5 text-indigo-600 mb-2" />
          <div className="font-medium">Create manually</div>
          <div className="text-xs text-gray-500 mt-1">
            Build the route step-by-step with the full configuration form.
          </div>
        </button>
        <button
          type="button"
          data-testid="new-route-card-nl"
          onClick={goNL}
          className="text-left rounded-lg border bg-white p-4 hover:border-indigo-500 hover:shadow transition"
        >
          <Sparkles className="h-5 w-5 text-indigo-600 mb-2" />
          <div className="font-medium">Create with AI</div>
          <div className="text-xs text-gray-500 mt-1">
            Describe the route in plain English; review the generated config.
          </div>
        </button>
      </div>
    </Modal>
  );
}
