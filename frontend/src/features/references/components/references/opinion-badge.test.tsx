import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpinionBadge } from './opinion-badge';
import type { Opinion } from '@/features/references/types/references';

const baseMember = {
  id: 1,
  user: {
    id: 10,
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
  },
  role: 'reviewer',
};

const makeOpinion = (status: Opinion['status']): Opinion => ({
  member: baseMember as any,
  status,
  stage: 'screening',
  reason: null,
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('Components - OpinionBadge', () => {
  it('should render the reviewer first name', () => {
    render(<OpinionBadge idx={0} opinion={makeOpinion('included')} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should show ✓ symbol for included status', () => {
    render(<OpinionBadge idx={0} opinion={makeOpinion('included')} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should show ? symbol for maybe status', () => {
    render(<OpinionBadge idx={0} opinion={makeOpinion('maybe')} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should show ✕ symbol for excluded status', () => {
    render(<OpinionBadge idx={0} opinion={makeOpinion('excluded')} />);
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('should show no status symbol for undecided', () => {
    render(<OpinionBadge idx={0} opinion={makeOpinion('undecided')} />);
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('?')).not.toBeInTheDocument();
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  it('should display the reason when provided', () => {
    const opinion: Opinion = {
      ...makeOpinion('excluded'),
      reason: 'Off-topic',
    };
    render(<OpinionBadge idx={0} opinion={opinion} />);
    expect(screen.getByText('- Off-topic')).toBeInTheDocument();
  });
});
