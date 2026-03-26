import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteItem, NotesList } from './note';
import type { Note } from '@/features/references/types/notes';
import type { User } from '@/features/users/types/auth';

vi.mock('@/features/references/hooks/use-notes', () => ({
  useUpdateNote: vi.fn(),
  useDeleteNote: vi.fn(),
  useFetchNotes: vi.fn(),
}));

vi.mock('@/features/users/hooks/use-auth', () => ({
  useFetchUser: vi.fn(),
}));

import {
  useUpdateNote,
  useDeleteNote,
  useFetchNotes,
} from '@/features/references/hooks/use-notes';
import { useFetchUser } from '@/features/users/hooks/use-auth';

const mockUseUpdateNote = vi.mocked(useUpdateNote);
const mockUseDeleteNote = vi.mocked(useDeleteNote);
const mockUseFetchNotes = vi.mocked(useFetchNotes);
const mockUseFetchUser = vi.mocked(useFetchUser);

const noopMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
};

const mockUser: User = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
} as any;

const mockNote: Note = {
  id: 10,
  content: 'This is a note',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  member: {
    id: 5,
    user: {
      id: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    },
    role: 'reviewer',
  } as any,
  referenceId: 100,
  reviewId: 1,
};

describe('Components - NoteItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateNote.mockReturnValue(noopMutation as any);
    mockUseDeleteNote.mockReturnValue(noopMutation as any);
  });

  it('should render the note content', () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    expect(screen.getByText('This is a note')).toBeInTheDocument();
  });

  it('should render the author full name', () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('should show edit and delete buttons when current user is the author', () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    // Edit and delete icon buttons are rendered for the author
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('should not show edit/delete actions when current user is not the author', () => {
    const otherUser: User = { ...mockUser, id: 999 };
    render(
      <NoteItem
        currentUser={otherUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    // No action buttons rendered for non-authors
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should switch to edit mode when the edit button is clicked', async () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    // The edit button (pencil icon) triggers edit mode
    const editBtn = screen.getAllByRole('button')[0];
    await userEvent.click(editBtn);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it('should cancel editing and restore original content on Cancel', async () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    const editBtn = screen.getAllByRole('button')[0];
    await userEvent.click(editBtn);
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'Changed text');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('This is a note')).toBeInTheDocument();
  });

  it('should call updateNote.mutateAsync on Save Changes', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseUpdateNote.mockReturnValue({ ...noopMutation, mutateAsync } as any);

    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    const editBtn = screen.getAllByRole('button')[0];
    await userEvent.click(editBtn);
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Updated note text');
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i })
    );

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 10,
        referenceId: 100,
        payload: { content: 'Updated note text' },
      })
    );
  });

  it('should show delete confirmation dialog when delete is triggered', async () => {
    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    // Second button is the delete (trash) button
    const deleteBtn = screen.getAllByRole('button')[1];
    await userEvent.click(deleteBtn);
    expect(screen.getByText('Delete Note')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this note/)
    ).toBeInTheDocument();
  });

  it('should call deleteNote.mutateAsync when deletion is confirmed', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteNote.mockReturnValue({ ...noopMutation, mutateAsync } as any);

    render(
      <NoteItem
        currentUser={mockUser}
        referenceId={100}
        note={mockNote}
        compact={false}
      />
    );
    const deleteBtn = screen.getAllByRole('button')[1];
    await userEvent.click(deleteBtn);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mutateAsync).toHaveBeenCalledWith({ noteId: 10, referenceId: 100 });
  });

  describe('compact mode', () => {
    it('should render author name and note content in compact mode', () => {
      render(
        <NoteItem
          currentUser={mockUser}
          referenceId={100}
          note={mockNote}
          compact={true}
        />
      );
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('This is a note')).toBeInTheDocument();
    });
  });
});

describe('Components - NotesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateNote.mockReturnValue(noopMutation as any);
    mockUseDeleteNote.mockReturnValue(noopMutation as any);
    mockUseFetchUser.mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);
  });

  it('should show loading state while fetching', () => {
    mockUseFetchNotes.mockReturnValue({
      data: [],
      isLoading: true,
    } as any);
    render(<NotesList referenceId={100} />);
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  it('should show empty state message when there are no notes', () => {
    mockUseFetchNotes.mockReturnValue({ data: [], isLoading: false } as any);
    render(<NotesList referenceId={100} />);
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('should use a custom empty message', () => {
    mockUseFetchNotes.mockReturnValue({ data: [], isLoading: false } as any);
    render(<NotesList referenceId={100} emptyMessage="Start adding notes!" />);
    expect(screen.getByText('Start adding notes!')).toBeInTheDocument();
  });

  it('should render a NoteItem for each note', () => {
    const notes = [mockNote, { ...mockNote, id: 11, content: 'Second note' }];
    mockUseFetchNotes.mockReturnValue({ data: notes, isLoading: false } as any);
    render(<NotesList referenceId={100} />);
    expect(screen.getByText('This is a note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();
  });
});
