import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import EmailChipsInput from '@/components/email-chip-input';
import { useSendInvitations } from '@/hooks/use-invitation';

export default function InvitationDialog({
  reviewId,
}: {
  reviewId: number | string;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const sendInviteMutation = useSendInvitations(reviewId);

  const handleSend = () => {
    sendInviteMutation.mutate(emails, {
      onSuccess: () => {
        setEmails([]);
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Send Invites</Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Invitations</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <EmailChipsInput value={emails} onChange={setEmails} />
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
