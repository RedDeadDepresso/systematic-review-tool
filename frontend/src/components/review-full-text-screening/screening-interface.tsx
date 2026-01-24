import { useState } from 'react';
import type { Reference } from '@/types/reference';
import type { Keyword } from '@/types/keyword';
import { KeywordFilters } from '@/components/review-screening/keyword-filters';
import { ReferenceTable } from './reference-table';
import { Header } from '@/components/review-screening/header';

export default function ScreeningInterface({
  reviewId,
  references,
  inclusiveKeywords,
  exclusiveKeywords,
}: {
  reviewId: string | number;
  references: Reference[];
  inclusiveKeywords: Keyword[];
  exclusiveKeywords: Keyword[];
}) {
  const [statusFilter, setStatusFilter] = useState('Undecided');
  const [selectedReference, setSelectedReference] = useState<number | null>(
    null
  );
  const [hideKeywordFilters, setHideKeywordFilters] = useState(false);
  const [selectedIncludeKeywords, setSelectedIncludeKeywords] = useState<
    string[]
  >([]);
  const [selectedExcludeKeywords, setSelectedExcludeKeywords] = useState<
    string[]
  >([]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Navigation Menu */}
      <Header
        reviewId={Number(reviewId)}
        references={references}
        statusFilter={statusFilter}
        hideKeywordFilters={hideKeywordFilters}
        setHideKeywordFilters={setHideKeywordFilters}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - references List */}
        <ReferenceTable
          reviewId={Number(reviewId)}
          data={references}
          selectedReference={selectedReference}
          setSelectedReference={setSelectedReference}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedIncludeKeywords={selectedIncludeKeywords}
          selectedExcludeKeywords={selectedExcludeKeywords}
        />

        {/* Right Sidebar - Filters */}
        {!hideKeywordFilters && (
          <KeywordFilters
            reviewId={Number(reviewId)}
            inclusiveKeywords={inclusiveKeywords}
            exclusiveKeywords={exclusiveKeywords}
            selectedIncludeKeywords={selectedIncludeKeywords}
            setSelectedIncludeKeywords={setSelectedIncludeKeywords}
            selectedExcludeKeywords={selectedExcludeKeywords}
            setSelectedExcludeKeywords={setSelectedExcludeKeywords}
          />
        )}
      </div>
    </div>
  );
}
