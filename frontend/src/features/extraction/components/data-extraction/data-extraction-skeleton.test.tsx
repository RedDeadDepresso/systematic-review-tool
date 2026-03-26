import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataExtractionSkeleton } from './data-extraction-skeleton';

describe('Components - DataExtractionSkeleton', () => {
  it('should render 14 skeleton rows by default', () => {
    const { container } = render(
      <table>
        <tbody>
          <DataExtractionSkeleton />
        </tbody>
      </table>
    );
    const rows = container.querySelectorAll('tr');
    expect(rows).toHaveLength(14);
  });

  it('should render default 4 question skeleton columns per row', () => {
    const { container } = render(
      <table>
        <tbody>
          <DataExtractionSkeleton questionCount={4} />
        </tbody>
      </table>
    );
    // Each row: checkbox, index, title, completed, pdf (5 fixed) + 4 question cols + 1 trailing = 10 tds
    const firstRow = container.querySelector('tr');
    expect(firstRow?.querySelectorAll('td').length).toBe(10);
  });

  it('should render the correct number of question columns when overridden', () => {
    const { container } = render(
      <table>
        <tbody>
          <DataExtractionSkeleton questionCount={6} />
        </tbody>
      </table>
    );
    // Each row: checkbox, index, title, completed, pdf (5 fixed) + 6 question cols + 1 trailing = 12 tds
    const firstRow = container.querySelector('tr');
    expect(firstRow?.querySelectorAll('td').length).toBe(12);
  });
});
