export function errorMessage(error: any) {
  if (!error?.response?.data) return null;

  return (
    <ul className="text-red-500 text-sm list-disc">
      {Object.entries(error.response.data).map(
        ([field, messages]: [string, any], index) =>
          Array.isArray(messages) ? (
            messages.map((message: string, i: number) => (
              <li key={`${field}-${i}`}>{message}</li>
            ))
          ) : (
            <li key={`${field}-${index}`}>{String(messages)}</li>
          )
      )}
    </ul>
  );
}
