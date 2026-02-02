import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogTrigger,
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
import EmailChipsInput from '@/components/review-index/email-chip-input';
import { useSendInvitations } from '@/hooks/use-invitation';
import type { InvitationRole } from '@/types/invitation';

export default function InvitationDialog({
  reviewId,
  trigger,
}: {
  reviewId: number;
  trigger: ReactNode;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<InvitationRole>('Reviewer');

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
          setRole('Reviewer');
        },
      }
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

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
              <SelectItem value="Reviewer">Reviewer</SelectItem>
              <SelectItem value="Viewer">Viewer</SelectItem>
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
