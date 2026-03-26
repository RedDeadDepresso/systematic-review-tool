import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateItemDialog } from './create-item-dialog';

const Trigger = <button>Open</button>;

describe('Components - CreateItemDialog', () => {
  it('should open the dialog when the trigger is clicked', async () => {
    render(
      <CreateItemDialog type="code" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Create Code')).toBeInTheDocument();
  });

  it('should show correct title for subTheme type', async () => {
    render(
      <CreateItemDialog type="subTheme" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Create Sub Theme')).toBeInTheDocument();
  });

  it('should show correct title for mainTheme type', async () => {
    render(
      <CreateItemDialog type="mainTheme" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Create Main Theme')).toBeInTheDocument();
  });

  it('should have the Create button disabled when name is empty', async () => {
    render(
      <CreateItemDialog type="code" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('should enable Create button when name is entered', async () => {
    render(
      <CreateItemDialog type="code" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(screen.getByLabelText('Name'), 'My Code');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('should call onCreate with name and description on submit', async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    render(
      <CreateItemDialog type="code" onCreate={onCreate}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    await userEvent.type(screen.getByLabelText('Name'), 'New Code');
    await userEvent.type(screen.getByLabelText('Comment'), 'A description');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith('New Code', 'A description');
  });

  it('should show Comment label for code type and Description for others', async () => {
    render(
      <CreateItemDialog type="subTheme" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('should close dialog when Cancel is clicked', async () => {
    render(
      <CreateItemDialog type="code" onCreate={vi.fn()}>
        {Trigger}
      </CreateItemDialog>
    );
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Create Code')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Create Code')).not.toBeInTheDocument();
  });
});
