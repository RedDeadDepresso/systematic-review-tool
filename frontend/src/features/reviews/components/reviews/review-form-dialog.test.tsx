import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReviewFormDialog } from './review-form-dialog';
import { waitFor } from '@testing-library/react';

const defaultProps = {
  dialogTitle: 'Create Review',
  dialogDescription: 'Fill in the details below.',
  onSubmit: vi.fn(),
  open: true,
  onOpenChange: vi.fn(),
};

describe('Components - ReviewFormDialog', () => {
  it('should render dialog title and description', () => {
    render(<ReviewFormDialog {...defaultProps} />);
    expect(screen.getByText('Create Review')).toBeInTheDocument();
    expect(screen.getByText('Fill in the details below.')).toBeInTheDocument();
  });

  it('should pre-fill title and description when initialValues provided', () => {
    render(
      <ReviewFormDialog
        {...defaultProps}
        initialTitle="Existing Title"
        initialDescription="Existing Desc"
      />
    );
    expect(screen.getByDisplayValue('Existing Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Desc')).toBeInTheDocument();
  });

  it('should call onSubmit with form values on Save', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <ReviewFormDialog
        {...defaultProps}
        onSubmit={onSubmit}
        onOpenChange={() => {}}
      />
    );

    await user.type(screen.getByLabelText('Title'), 'New Review');
    await user.type(screen.getByLabelText('Description'), 'Review description');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'New Review',
        description: 'Review description',
      });
    });
  });

  it('should disable inputs and Save button when disabled prop is true', () => {
    render(<ReviewFormDialog {...defaultProps} disabled />);
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('should not render content when open is false', () => {
    render(<ReviewFormDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Create Review')).not.toBeInTheDocument();
  });
});
