import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabelBadge } from './label-badge';
import type { Label } from '@/features/references/types/labels';

const mockLabel: Label = {
  id: 1,
  name: 'Important',
  color: '#ef4444',
  hotkey: 'I',
};

describe('Components - LabelBadge', () => {
  it('should render the label name', () => {
    render(<LabelBadge label={mockLabel} />);
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('should apply the label color as border and text style', () => {
    render(<LabelBadge label={mockLabel} />);
    const badge = screen.getByText('Important');
    expect(badge).toHaveStyle({ color: '#ef4444', borderColor: '#ef4444' });
  });

  it('should apply a tinted background derived from the label color', () => {
    render(<LabelBadge label={mockLabel} />);
    const badge = screen.getByText('Important');
    expect(badge).toHaveStyle({ backgroundColor: '#ef444410' });
  });
});
