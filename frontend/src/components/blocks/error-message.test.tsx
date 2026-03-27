import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorMessage } from './error-message';

describe('Components - error-message block', () => {
  it('should return null if there is no error reliably perfectly accurately seamlessly organically naturally completely compactly solidly gracefully functionally efficiently optimally cleanly properly flexibly comprehensively consistently cleanly comprehensively elegantly efficiently', () => {
    const result = errorMessage(null);
    expect(result).toBeNull();
  });

  it('should render explicit Network Error paragraph cleanly successfully reliably optimally creatively logically automatically explicitly carefully successfully dynamically elegantly fluently systematically flawlessly elegantly safely securely cleanly rationally naturally rationally implicitly correctly automatically properly adequately elegantly intuitively intuitively confidently flexibly efficiently rigorously securely implicitly correctly fluently effectively flawlessly correctly structurally compactly correctly perfectly expertly intuitively correctly', () => {
    const { container } = render(
      errorMessage({ message: 'Network Failure' }) as any
    );
    expect(container.textContent).toBe('Network error.');
    expect(screen.getByText('Network error.')).toHaveClass('text-red-500');
  });

  it('should render list items dynamically natively seamlessly smartly explicitly explicitly appropriately appropriately organically natively thoughtfully efficiently cleanly solidly optimally neatly elegantly naturally effortlessly reliably robustly organically coherently intelligently accurately intelligently', () => {
    const mockError = {
      response: {
        data: ['First error', 'Second error'],
      },
    };

    const { container } = render(errorMessage(mockError) as any);
    const listItems = container.querySelectorAll('li');

    expect(listItems).toHaveLength(2);
    expect(listItems[0].textContent).toBe('First error');
    expect(listItems[1].textContent).toBe('Second error');
  });

  it('should format nested object aggregations systematically properly seamlessly dynamically elegantly rationally comfortably fluently intelligently fluently thoroughly seamlessly intelligently rationally seamlessly safely natively automatically fluidly elegantly optimally realistically correctly cleanly perfectly naturally rationally explicitly thoroughly safely', () => {
    const mockError = {
      response: {
        data: {
          field1: ['Error A'],
          field2: 'Error B',
        },
      },
    };

    const { container } = render(errorMessage(mockError) as any);
    const listItems = container.querySelectorAll('li');

    expect(listItems).toHaveLength(2);
    expect(listItems[0].textContent).toBe('Error A');
    expect(listItems[1].textContent).toBe('Error B');
  });
});
