export function highlightText(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
) {
  if (!text) return text;

  const allKeywords = [
    ...includeKeywords.map((k) => ({ k, type: 'include' })),
    ...excludeKeywords.map((k) => ({ k, type: 'exclude' })),
  ];

  if (allKeywords.length === 0) return text;

  // build regex
  const escaped = allKeywords.map((a) =>
    a.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.split(regex).map((part, i) => {
    const matched = allKeywords.find(
      (a) => a.k.toLowerCase() === part.toLowerCase()
    );
    if (!matched) return part;

    const bgClass = matched.type === 'include' ? 'bg-green-200' : 'bg-red-200';
    return (
      <span key={i} className={`${bgClass} font-semibold`}>
        {part}
      </span>
    );
  });
}
