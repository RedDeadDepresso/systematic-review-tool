import {
  AlignLeft,
  BookOpen,
  CircleUser,
  FileText,
  Search,
  Users,
} from 'lucide-react';
import { NoteList } from './notes';
import type { Reference } from '@/types/reference';
import { DecisionButtons } from './decision-buttons';
import { Input } from '../ui/input';
import { useCreateNote } from '@/hooks/use-note';
import React from 'react';
import { Button } from '../ui/button';
import { highlightText } from './highlight-text';

export function ArticleDetails({
  reviewId,
  reference,
  selectedIncludeKeywords,
  selectedExcludeKeywords,
}: {
  reviewId: number;
  reference: Reference | null;
  selectedIncludeKeywords: string[];
  selectedExcludeKeywords: string[];
}) {
  const createNote = useCreateNote();
  const [content, setContent] = React.useState('');
  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || reference === null) return;

    createNote.mutate(
      {
        reviewId,
        referenceId: reference.id,
        data: { content },
      },
      {
        onSuccess: () => {
          setContent('');
        },
        onError: (error) => {
          console.error(error);
        },
      }
    );
  };

  return (
    <div className="flex-1 border-r border-gray-200 flex flex-col ">
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold ">
            {reference !== null &&
              highlightText(
                reference.title,
                selectedIncludeKeywords,
                selectedExcludeKeywords
              )}
          </h2>
          {/* <Button variant="ghost" size="sm" className="px-2">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button> */}
        </div>
      </div>
      {reference === null ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-gray-500">Select an article to view details</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Publication Types:
              </h3>
              <p className="text-sm">{reference.publication_types}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Authors:
              </h3>
              <p className="text-sm">{reference.authors}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Journal:
              </h3>
              <p className="text-sm">{reference.journal}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Methods:
              </h3>
              <p className="text-sm">{reference.search_methods}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlignLeft className="w-5 h-5" />
                Abstract:
              </h3>
              <p className="text-sm">
                {reference.abstract &&
                  highlightText(
                    reference.abstract,
                    selectedIncludeKeywords,
                    selectedExcludeKeywords
                  )}
              </p>
            </div>

            <NoteList reviewId={Number(reviewId)} referenceId={reference.id} />

            {/* <div>
                  <h3 className="text-sm font-semibold  mb-2 flex items-center gap-2">
                    <span className="text-lg">⚙️</span>
                    Article Customizations:
                  </h3>
                  <p className="text-sm ">Accessed: 31/03/2025</p>
                </div> */}
          </div>
          {/* Decision Buttons */}
          <div className="border-t border-gray-200 p-6">
            <DecisionButtons
              reviewId={Number(reviewId)}
              reference={reference}
            />

            <div className="flex items-center gap-2 p-3 rounded-lg w-full">
              <CircleUser className="h-8 w-8 " />
              <form
                onSubmit={handleNoteSubmit}
                className="flex items-center space-x-2 w-full"
              >
                <Input
                  type="text"
                  placeholder="Add note"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 bg-transparent text-sm placeholder-gray-400 outline-none w-full"
                />
                <Button type="submit" disabled={createNote.isPending}>
                  {createNote.isPending ? 'Saving...' : 'Add'}
                </Button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
