import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditItemDialog } from './edit-item-dialog';

const defaultProps = {
  type: 'code' as const,
  initialName: 'Old Name',
  initialDescription: 'Old Description',
  onSave: vi.fn(),
};

const Trigger = <button>Edit</button>;

describe('Components - EditItemDialog', () => {
  it('should open with pre-filled name and description', async () => {
    render(<EditItemDialog {...defaultProps}>{Trigger}</EditItemDialog>);
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Old Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Description')).toBeInTheDocument();
  });

  it('should show correct title for each type', async () => {
    render(
      <EditItemDialog {...defaultProps} type="subTheme">
        {Trigger}
      </EditItemDialog>
    );
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Sub Theme')).toBeInTheDocument();
  });

  it('should call onSave with trimmed updated values', async () => {
    const onSave = vi.fn();
    render(
      <EditItemDialog {...defaultProps} onSave={onSave}>
        {Trigger}
      </EditItemDialog>
    );
    await userEvent.click(screen.getByText('Edit'));
    const nameInput = screen.getByDisplayValue('Old Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Name ');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledWith('New Name', 'Old Description');
  });

  it('should disable Save Changes when name is cleared', async () => {
    render(<EditItemDialog {...defaultProps}>{Trigger}</EditItemDialog>);
    await userEvent.click(screen.getByText('Edit'));
    const nameInput = screen.getByDisplayValue('Old Name');
    await userEvent.clear(nameInput);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  it('should reset values to initial when reopened', async () => {
    render(<EditItemDialog {...defaultProps}>{Trigger}</EditItemDialog>);
    await userEvent.click(screen.getByText('Edit'));
    await userEvent.clear(screen.getByDisplayValue('Old Name'));
    await userEvent.type(
      screen.getByRole('textbox', { name: /name/i }),
      'Changed'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Old Name')).toBeInTheDocument();
  });

  it('should close dialog when Cancel is clicked', async () => {
    render(<EditItemDialog {...defaultProps}>{Trigger}</EditItemDialog>);
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Code')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Edit Code')).not.toBeInTheDocument();
  });
});
