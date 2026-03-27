// Renders API error responses as a red list, or a generic network-error message.
import type { JSX } from 'react';

export function errorMessage(error: any) {
  if (!error) return null;

  if (!error.response) {
    return <p className="text-red-500">Network error.</p>;
  }

  const data = error.response.data;

  // Recursively flattens arrays and objects from the API error body into <li> elements
  const renderMessages = (messages: any, prefix = ''): JSX.Element[] => {
    if (Array.isArray(messages)) {
      return messages.map((msg, i) => (
        <li key={`${prefix}-${i}`}>{String(msg)}</li>
      ));
    }

    if (typeof messages === 'object' && messages !== null) {
      return Object.entries(messages).flatMap(([k, v]) =>
        renderMessages(v, `${prefix}-${k}`)
      );
    }

    return [<li key={prefix}>{String(messages)}</li>];
  };

  return (
    <ul className="text-red-500 text-sm list-disc">{renderMessages(data)}</ul>
  );
}
