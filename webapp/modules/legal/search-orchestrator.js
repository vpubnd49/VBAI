/**
 * Client-side search API orchestrator.
 */
export async function executeLegalSearchApi({ query, forceFresh = false, apiBaseUrl = '' }) {
  const endpoint = `${apiBaseUrl}/api/web-search`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, forceFresh }),
  });

  if (!response.ok) {
    throw new Error(`Search API error status: ${response.status}`);
  }

  return await response.json();
}
