import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
};

describe('Components - DeleteConfirmationDialog', () => {
  describe('type: code', () => {
    it('should show Delete Code title', () => {
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          type="code"
          itemName="My Code"
        />
      );
      expect(screen.getByText('Delete Code')).toBeInTheDocument();
    });

    it('should include the item name in the description', () => {
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          type="code"
          itemName="My Code"
        />
      );
      expect(screen.getByText(/My Code/)).toBeInTheDocument();
    });

    it('should call onConfirm with no options when confirmed', async () => {
      const onConfirm = vi.fn();
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          type="code"
          itemName="My Code"
        />
      );
      await userEvent.click(screen.getByText('Delete'));
      expect(onConfirm).toHaveBeenCalledWith();
    });
  });

  describe('type: subTheme', () => {
    it('should show Delete Sub Theme title', () => {
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          type="subTheme"
          itemName="Theme A"
        />
      );
      expect(screen.getByText('Delete Sub Theme')).toBeInTheDocument();
    });

    it('should call onConfirm with deleteCodes option', async () => {
      const onConfirm = vi.fn();
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          type="subTheme"
          itemName="Theme A"
        />
      );
      await userEvent.click(screen.getByText('Delete'));
      expect(onConfirm).toHaveBeenCalledWith({ deleteCodes: false });
    });
  });

  describe('type: mainTheme', () => {
    it('should show Delete Main Theme title', () => {
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          type="mainTheme"
          itemName="Main A"
        />
      );
      expect(screen.getByText('Delete Main Theme')).toBeInTheDocument();
    });

    it('should call onConfirm with deleteSubThemes and deleteCodes options', async () => {
      const onConfirm = vi.fn();
      render(
        <DeleteConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          type="mainTheme"
          itemName="Main A"
        />
      );
      await userEvent.click(screen.getByText('Delete'));
      expect(onConfirm).toHaveBeenCalledWith({
        deleteSubThemes: false,
        deleteCodes: false,
      });
    });
  });

  it('should call onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmationDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        type="code"
        itemName="X"
      />
    );
    await userEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not render when open is false', () => {
    render(
      <DeleteConfirmationDialog
        {...defaultProps}
        open={false}
        type="code"
        itemName="X"
      />
    );
    expect(screen.queryByText('Delete Code')).not.toBeInTheDocument();
  });
});
