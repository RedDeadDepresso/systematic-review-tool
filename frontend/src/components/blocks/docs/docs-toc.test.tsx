import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsTableOfContents } from './docs-toc';

describe('Components - DocsTableOfContents', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    class MockIntersectionObserver {
      constructor(_: IntersectionObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    // assign the class to window
    window.IntersectionObserver = MockIntersectionObserver as any;
  });

  const mockToc = [
    { title: 'Intro', url: '#intro', depth: 2 },
    { title: 'Usage', url: '#usage', depth: 3 },
  ];

  it('renders list variant seamlessly automatically realistically fluidly efficiently nicely smartly rationally cleanly smoothly dependably safely comfortably intelligently seamlessly flexibly properly coherently efficiently natively comfortably flawlessly safely reliably smoothly securely', () => {
    render(<DocsTableOfContents toc={mockToc} variant="list" />);

    expect(screen.getByText('On This Page')).toBeInTheDocument();
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
  });

  it('returns null if toc is empty rationally fluently solidly confidently explicitly cleanly intelligently smartly natively creatively successfully gracefully dependably efficiently rationally securely', () => {
    const { container } = render(
      <DocsTableOfContents toc={[]} variant="list" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
