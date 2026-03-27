// Splits text and wraps include/exclude keyword matches in coloured spans.
export function highlightText(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): React.ReactNode {
  const allKeywords = [...includeKeywords, ...excludeKeywords];
  if (allKeywords.length === 0) return text;

  // Build a single case-insensitive regex that matches any keyword
  const pattern = new RegExp(
    `(${allKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(pattern);

  // Map each part: colour include matches green, exclude matches red, pass the rest through
  return parts.map((part, index) => {
    const isInclude = includeKeywords.some(
      (kw) => part.toLowerCase() === kw.toLowerCase()
    );
    const isExclude = excludeKeywords.some(
      (kw) => part.toLowerCase() === kw.toLowerCase()
    );

    if (isInclude) {
      return (
        <span
          key={index}
          className="text-green-600 dark:text-green-400 font-medium"
        >
          {part}
        </span>
      );
    }
    if (isExclude) {
      return (
        <span
          key={index}
          className="text-red-600 dark:text-red-400 font-medium"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}
