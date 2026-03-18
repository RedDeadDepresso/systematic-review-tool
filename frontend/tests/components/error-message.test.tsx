import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { errorMessage } from '../../src/components/blocks/error-message';

describe('errorMessage function', () => {
  it('should return null if no error is provided', () => {
    const { container } = render(errorMessage(null) as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render a generic network error if error has no response property', () => {
    const errorWithoutResponse = new Error('Some internal error');
    // Call as function
    render(errorMessage(errorWithoutResponse) as React.ReactElement);

    expect(screen.getByText('Network error.')).toBeInTheDocument();
  });

  it('should render unstructured data array from response properly', () => {
    const errorObj = {
      response: {
        data: ['Username is taken', 'Password is too short'],
      },
    };

    const { container } = render(errorMessage(errorObj) as React.ReactElement);

    expect(container).toHaveTextContent('Username is taken');
    expect(container).toHaveTextContent('Password is too short');
  });

  it('should render nested object error messages properly', () => {
    const errorObj = {
      response: {
        data: {
          email: ['Email is invalid'],
          profile: {
            age: ['Age must be at least 18'],
          },
        },
      },
    };

    const { container } = render(errorMessage(errorObj) as React.ReactElement);

    expect(container).toHaveTextContent('Email is invalid');
    expect(container).toHaveTextContent('Age must be at least 18');
  });

  it('should render primitive error messages properly', () => {
    const errorObj = {
      response: {
        data: 'Something went wrong on the server',
      },
    };

    const { container } = render(errorMessage(errorObj) as React.ReactElement);

    expect(container).toHaveTextContent('Something went wrong on the server');
  });
});
