import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmailChipsInput from './email-chip-input';

describe('Components - EmailChipsInput', () => {
  it('should render the input field', () => {
    render(<EmailChipsInput value={[]} onChange={vi.fn()} />);
    expect(
      screen.getByPlaceholderText('Type an email and press Enter')
    ).toBeInTheDocument();
  });

  it('should display existing email chips', () => {
    render(
      <EmailChipsInput
        value={['alice@example.com', 'bob@example.com']}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('should add a valid email on Enter keypress', async () => {
    const onChange = vi.fn();
    render(<EmailChipsInput value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Type an email and press Enter');
    await userEvent.type(input, 'new@example.com{Enter}');
    expect(onChange).toHaveBeenCalledWith(['new@example.com']);
  });

  it('should add a valid email on comma keypress', async () => {
    const onChange = vi.fn();
    render(<EmailChipsInput value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Type an email and press Enter');
    await userEvent.type(input, 'new@example.com,');
    expect(onChange).toHaveBeenCalledWith(['new@example.com']);
  });

  it('should not add an invalid email', async () => {
    const onChange = vi.fn();
    render(<EmailChipsInput value={[]} onChange={onChange} />);
    await userEvent.type(
      screen.getByPlaceholderText('Type an email and press Enter'),
      'notanemail{Enter}'
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not add a duplicate email', async () => {
    const onChange = vi.fn();
    render(
      <EmailChipsInput value={['alice@example.com']} onChange={onChange} />
    );
    await userEvent.type(
      screen.getByPlaceholderText('Type an email and press Enter'),
      'alice@example.com{Enter}'
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should remove a chip when the X button is clicked', async () => {
    const onChange = vi.fn();
    render(
      <EmailChipsInput value={['alice@example.com']} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should remove the last chip on Backspace when input is empty', async () => {
    const onChange = vi.fn();
    render(
      <EmailChipsInput
        value={['alice@example.com', 'bob@example.com']}
        onChange={onChange}
      />
    );
    const input = screen.getByPlaceholderText('Type an email and press Enter');
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['alice@example.com']);
  });

  it('should normalise email to lowercase', async () => {
    const onChange = vi.fn();
    render(<EmailChipsInput value={[]} onChange={onChange} />);
    await userEvent.type(
      screen.getByPlaceholderText('Type an email and press Enter'),
      'UPPER@Example.COM{Enter}'
    );
    expect(onChange).toHaveBeenCalledWith(['upper@example.com']);
  });
});
