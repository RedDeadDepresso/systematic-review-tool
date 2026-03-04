import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmailChipsInput from '@/features/reviews/components/review-invitations/email-chip-input';
import { useSendInvitations } from '@/features/reviews/hooks/use-review-invitations';
import type { InvitationRole } from '@/features/reviews/types/invitations';

export interface InvitationDialogProps {
  reviewId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvitationDialog({
  reviewId,
  open,
  onOpenChange,
}: InvitationDialogProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<InvitationRole>('collaborator');

  const sendInviteMutation = useSendInvitations();

  const handleSend = () => {
    sendInviteMutation.mutate(
      {
        review: reviewId,
        emails,
        role,
      },
      {
        onSuccess: () => {
          setEmails([]);
          setRole('collaborator');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Invitations</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <EmailChipsInput value={emails} onChange={setEmails} />

          <Select
            value={role}
            onValueChange={(v) => setRole(v as InvitationRole)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collaborator">Collaborator</SelectItem>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="viewer">viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={emails.length === 0 || sendInviteMutation.isPending}
          >
            {sendInviteMutation.isPending ? 'Sending...' : 'Send Invites'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
