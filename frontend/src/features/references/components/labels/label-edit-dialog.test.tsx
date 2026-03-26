import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelEditDialog } from './label-edit-dialog';
import type { Label } from '@/features/references/types/labels';

vi.mock('@/features/references/hooks/use-labels', () => ({
  useUpdateLabel: vi.fn(),
}));

import { useUpdateLabel } from '@/features/references/hooks/use-labels';

const mockUseUpdateLabel = vi.mocked(useUpdateLabel);
const defaultMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
};

const mockLabel: Label = {
  id: 1,
  name: 'Urgent',
  color: '#ef4444',
  hotkey: 'U',
};

describe('Components - LabelEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateLabel.mockReturnValue(defaultMutation as any);
  });

  it('should render dialog title with label name', () => {
    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Edit label "Urgent"')).toBeInTheDocument();
  });

  it('should pre-fill the name input with the current label name', () => {
    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByDisplayValue('Urgent')).toBeInTheDocument();
  });

  it('should pre-fill the hotkey field with the current hotkey', () => {
    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByDisplayValue('U')).toBeInTheDocument();
  });

  it('should call onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <LabelEditDialog
        label={mockLabel}
        open={true}
        onOpenChange={onOpenChange}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should call mutate with updated name and color on Save', async () => {
    const mutate = vi.fn();
    mockUseUpdateLabel.mockReturnValue({ ...defaultMutation, mutate } as any);

    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );

    const nameInput = screen.getByDisplayValue('Urgent');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Critical');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        payload: expect.objectContaining({ name: 'Critical' }),
      }),
      expect.any(Object)
    );
  });

  it('should show Saving... button text while pending', () => {
    mockUseUpdateLabel.mockReturnValue({
      ...defaultMutation,
      isPending: true,
    } as any);
    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Saving...' })
    ).toBeInTheDocument();
  });

  it('should clear the hotkey when the clear (X) button next to the hotkey input is clicked', async () => {
    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );
    // The X clear button sits directly next to the hotkey readonly input.
    // Find it by querying the parent relative container then the button inside it.
    const hotkeyInput = screen.getByDisplayValue('U');
    const clearBtn = hotkeyInput.parentElement!.querySelector(
      'button'
    ) as HTMLElement;
    await userEvent.click(clearBtn);
    expect(
      screen.getByPlaceholderText('Press a key combination...')
    ).toHaveValue('');
  });

  it('should select a preset color swatch when clicked and submit with that color', async () => {
    const mutate = vi.fn();
    mockUseUpdateLabel.mockReturnValue({ ...defaultMutation, mutate } as any);

    render(
      <LabelEditDialog label={mockLabel} open={true} onOpenChange={vi.fn()} />
    );

    // Click the green swatch (#10b981) — it's visually distinct from the current red color
    const greenSwatch = document.querySelectorAll('button[type="button"]');
    Array.from(greenSwatch).forEach((btn) => {
      const style = (btn as HTMLElement).style.backgroundColor;
      // rgb(16, 185, 129) === #10b981
      if (style === 'rgb(16, 185, 129)') {
        (btn as HTMLElement).click();
      }
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ color: '#10b981' }),
      }),
      expect.any(Object)
    );
  });

  it('should not render when open is false', () => {
    render(
      <LabelEditDialog label={mockLabel} open={false} onOpenChange={vi.fn()} />
    );
    expect(screen.queryByText('Edit label "Urgent"')).not.toBeInTheDocument();
  });
});
