/**
 * Search context formatter for prompt injection.
 */
export function formatSearchContextForPrompt(searchResults = []) {
  if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
    return 'Không tìm thấy căn cứ dữ liệu tìm kiếm bổ sung.';
  }

  return searchResults
    .map((item, idx) => {
      const title = item.title || 'Kết quả không tiêu đề';
      const snippet = item.snippet || item.text || '';
      const link = item.link || item.source_url || '';
      const num = item.documentNumber ? ` [Số hiệu: ${item.documentNumber}]` : '';
      return `[${idx + 1}] ${title}${num}\nNguồn: ${link}\nNội dung: ${snippet}`;
    })
    .join('\n\n');
}
