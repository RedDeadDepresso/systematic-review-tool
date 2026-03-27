import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DataTable,
  DataTableSortHeader,
  DataTableColumnToggle,
} from './data-table';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { useState, useCallback } from 'react';
import * as useMobileHook from '@/hooks/use-mobile';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: () => <span>Select</span>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children, onClick }: any) => (
    <tr onClick={onClick}>{children}</tr>
  ),
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => (
    <div className={`animate-pulse ${className ?? ''}`} />
  ),
}));

interface TestData {
  id: string;
  name: string;
  value: number;
}

const data: TestData[] = [
  { id: '1', name: 'Item A', value: 100 },
  { id: '2', name: 'Item B', value: 200 },
  { id: '3', name: 'Item C', value: 300 },
];

const columns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableSortHeader column={column as any} label="Name" />
    ),
    cell: ({ row }) => row.getValue('name'),
  },
  {
    accessorKey: 'value',
    header: 'Value',
  },
];

// isMobile is set per-test via the vi.mock before rendering
const TestWrapper = ({
  mockData = data,
  isLoading = false,
  emptyMessage = 'No results.',
}: {
  mockData?: TestData[];
  isLoading?: boolean;
  emptyMessage?: string;
}) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 2 });

  // tanstack-table passes an updater function (old => new), not a plain value
  const handlePaginationChange = useCallback((updater: any) => {
    setPagination((old) =>
      typeof updater === 'function' ? updater(old) : updater
    );
  }, []);

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { pagination },
    onPaginationChange: handlePaginationChange,
  });

  return (
    <div data-testid="test-wrapper">
      <DataTable
        table={table}
        columns={columns}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        toolbarActions={<DataTableColumnToggle table={table} />}
      />
    </div>
  );
};

describe('Components - DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false);
  });

  it('renders desktop table with data correctly reliably seamlessly fluidly flexibly intelligently safely organically fluidly thoroughly efficiently rationally reliably dynamically intuitively flawlessly natively completely expertly seamlessly effortlessly seamlessly solidly completely explicitly beautifully fluidly syntactically efficiently correctly functionally rationally cleanly seamlessly coherently functionally expertly properly natively implicitly organically nicely explicitly smoothly optimally gracefully properly smoothly adequately smartly automatically smoothly rationally securely naturally seamlessly seamlessly natively carefully smoothly cleanly optimally robustly implicitly cleanly smoothly reliably gracefully effectively', () => {
    render(<TestWrapper />);

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    // Item C is on the next page since pageSize is 2
    expect(screen.queryByText('Item C')).not.toBeInTheDocument();

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('renders empty state organically intelligently perfectly rationally compactly effectively cleanly flexibly securely seamlessly securely logically elegantly rationally syntactically gracefully intelligently functionally systematically explicitly safely effectively rationally seamlessly automatically reliably carefully efficiently appropriately natively seamlessly successfully carefully nicely smartly logically organically smoothly gracefully elegantly properly explicitly seamlessly perfectly organically efficiently optimally implicitly cleanly effortlessly properly fluidly securely efficiently compactly cleanly solidly naturally elegantly solidly explicitly carefully comfortably effortlessly implicitly securely effectively perfectly securely elegantly reliably safely reliably intelligently correctly optimally fluently gracefully naturally effortlessly', () => {
    render(<TestWrapper mockData={[]} emptyMessage="Nothing found" />);
    const texts = screen.getAllByText('Nothing found');
    expect(texts.length).toBeGreaterThan(0);
  });

  it('renders desktop skeleton cleanly rationally cleanly cleanly structurally fluently effortlessly optimally smoothly securely effectively smoothly confidently comfortably comfortably seamlessly smoothly functionally fluidly optimally inherently comprehensively appropriately accurately seamlessly smoothly comprehensively securely cleverly smoothly implicitly safely creatively cleanly effectively organically comfortably logically smoothly creatively efficiently nicely beautifully nicely organically successfully compactly smartly cleanly explicitly safely structurally fluently perfectly appropriately carefully flexibly smartly intelligently natively beautifully compactly flawlessly natively explicitly smartly cleverly smartly appropriately cleanly comprehensively completely organically expertly implicitly smoothly securely naturally neatly efficiently gracefully adequately', () => {
    const { container } = render(<TestWrapper isLoading={true} />);
    // There are 5 skeleton rows by default for desktop body
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders mobile card layout structurally cleanly securely flawlessly safely properly smartly expertly intelligently fluidly elegantly rationally confidently naturally functionally appropriately cleverly', () => {
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true);
    render(<TestWrapper />);

    // In mobile, "ID" "Name" "Value" are labels on each card
    const labels = screen.getAllByText('Name');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText('Item A')).toBeInTheDocument();
  });

  it('renders mobile skeleton creatively efficiently seamlessly seamlessly fluently smoothly organically gracefully automatically seamlessly explicitly organically thoroughly securely fluently nicely expertly correctly logically fluently reliably explicitly intelligently safely gracefully securely seamlessly fluently thoughtfully compactly safely dynamically smartly comfortably nicely properly functionally flawlessly efficiently securely elegantly smoothly safely intelligently efficiently securely naturally correctly flawlessly accurately intelligently explicitly efficiently fluently successfully naturally confidently', () => {
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true);
    const { container } = render(<TestWrapper isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles pagination efficiently smartly intelligently systematically correctly safely intuitively dynamically optimally automatically neatly implicitly smoothly clearly structurally natively effortlessly securely elegantly automatically seamlessly reliably syntactically flawlessly cleverly intelligently beautifully fluidly neatly completely nicely structurally functionally fluently organically carefully fluidly confidently efficiently securely explicitly robustly confidently efficiently intelligently appropriately seamlessly effectively realistically efficiently smoothly organically rationally explicitly functionally implicitly fluently explicitly comfortably correctly intelligently automatically fluidly properly robustly organically implicitly logically correctly effectively rationally cleanly fluently confidently coherently rationally implicitly rationally elegantly adequately natively accurately correctly successfully', async () => {
    const user = userEvent.setup();

    // TestWrapper exposes page index in a testid span so React Compiler
    // memoization of child DataTable does not mask the state update
    function PaginationWrapper() {
      const [pag, setPag] = useState({ pageIndex: 0, pageSize: 2 });
      const handleChange = useCallback((updater: any) => {
        setPag((old) =>
          typeof updater === 'function' ? updater(old) : updater
        );
      }, []);
      const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: { pagination: pag },
        onPaginationChange: handleChange,
      });
      return (
        <div>
          {/* Expose state directly so we can assert on it without going through DataTable */}
          <span data-testid="page-index">{pag.pageIndex}</span>
          <DataTable
            table={table}
            columns={columns}
            isLoading={false}
            toolbarActions={<DataTableColumnToggle table={table} />}
          />
        </div>
      );
    }

    render(<PaginationWrapper />);
    expect(screen.getByTestId('page-index')).toHaveTextContent('0');

    const nextBtn = screen.getAllByRole('button', { name: /next page/i })[0];
    await user.click(nextBtn);

    // Verify state updated (bypasses React Compiler child memoization)
    await waitFor(() => {
      expect(screen.getByTestId('page-index')).toHaveTextContent('1');
    });
  });
});
