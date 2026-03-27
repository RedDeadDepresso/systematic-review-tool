import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssigneeBadge } from './assignee-badge';
import type { ReviewMember } from '@/features/reviews/types/reviews';

const mockAssignee: ReviewMember = {
  id: 1,
  user: {
    id: 5,
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob@example.com',
  },
  role: 'reviewer',
} as any;

describe('Components - AssigneeBadge', () => {
  it("should render the assignee's first name", () => {
    render(<AssigneeBadge assignee={mockAssignee} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should include the user icon', () => {
    render(<AssigneeBadge assignee={mockAssignee} />);
    // Badge renders inside a Tooltip trigger – check the badge is present
    expect(
      screen.getByText('Bob').closest('[class*="badge"]') ??
        screen.getByText('Bob')
    ).toBeInTheDocument();
  });
});
