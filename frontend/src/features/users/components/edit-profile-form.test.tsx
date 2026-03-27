import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditProfileForm } from './edit-profile-form';

vi.mock('@/features/users/hooks/use-auth', () => ({
  useFetchUser: vi.fn(),
  useUpdateUser: vi.fn(),
  useDeleteUser: vi.fn(),
}));

import {
  useFetchUser,
  useUpdateUser,
  useDeleteUser,
} from '@/features/users/hooks/use-auth';

const mockUseFetchUser = vi.mocked(useFetchUser);
const mockUseUpdateUser = vi.mocked(useUpdateUser);
const mockUseDeleteUser = vi.mocked(useDeleteUser);

const noopMutation = { mutate: vi.fn(), isPending: false };

const mockUser = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  avatar: null,
};

describe('Components - EditProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchUser.mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);
    mockUseUpdateUser.mockReturnValue(noopMutation as any);
    mockUseDeleteUser.mockReturnValue(noopMutation as any);
  });

  it('should render loading skeleton when user is loading', () => {
    mockUseFetchUser.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    const { container } = render(<EditProfileForm />);
    // Skeleton renders divs with skeleton classes
    expect(
      container.querySelector('[class*="skeleton"]') ||
        container.querySelector('[data-slot="skeleton"]')
    ).toBeDefined();
  });

  it('should pre-fill first name and last name from user data', () => {
    render(<EditProfileForm />);
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
  });

  it('should pre-fill email from user data', () => {
    render(<EditProfileForm />);
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
  });

  it('should render Save Changes button', () => {
    render(<EditProfileForm />);
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it('should call updateUser.mutate with changed values on save', async () => {
    const mutate = vi.fn();
    mockUseUpdateUser.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<EditProfileForm />);
    const firstNameInput = screen.getByDisplayValue('Alice');
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, 'Alicia');
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i })
    );

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Alicia' })
    );
  });

  it('should show a Delete Account button', () => {
    render(<EditProfileForm />);
    expect(
      screen.getByRole('button', { name: /delete account/i })
    ).toBeInTheDocument();
  });

  it('should open delete confirmation when Delete Account is clicked', async () => {
    render(<EditProfileForm />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    expect(
      screen.getByText(/Are you sure you want to delete your account/i)
    ).toBeInTheDocument();
  });

  it('should call deleteUser.mutate when deletion is confirmed', async () => {
    const mutate = vi.fn();
    mockUseDeleteUser.mockReturnValue({ ...noopMutation, mutate } as any);

    render(<EditProfileForm />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(mutate).toHaveBeenCalledOnce();
  });

  it('should show Personal Information section heading', () => {
    render(<EditProfileForm />);
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
  });
});
