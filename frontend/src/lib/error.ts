const extractMessages = (messages: any): string[] => {
  if (Array.isArray(messages)) return messages.map(String);
  if (typeof messages === 'object' && messages !== null) {
    if ('detail' in messages) return extractMessages(messages.detail);
    if ('error' in messages) return extractMessages(messages.error);
    return Object.values(messages).flatMap(extractMessages);
  }
  if (messages == null) return [];
  return [String(messages)];
};

export function errorMessageString(error: any): string {
  if (!error) return '';
  if (!error.response) return error.message || 'Network error';

  const data = error.response.data;

  try {
    const messages = extractMessages(data);
    const joined = messages.filter(Boolean).join(' ');
    if (!joined || joined.includes('[object Object]'))
      return 'An unexpected error occurred';
    return joined;
  } catch (e) {
    return 'An unexpected error occurred';
  }
}
