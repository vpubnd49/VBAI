/**
 * Citation renderer for legal source badges.
 */
export function renderCitationBadge({ title = '', url = '', sourceTier = 'unknown' }) {
  const isOfficial = sourceTier === 'official';
  const badgeClass = isOfficial ? 'badge-official' : 'badge-reference';
  const label = isOfficial ? 'Nguồn chính thức' : 'Nguồn tham khảo';
  return `<span class="legal-citation ${badgeClass}"><a href="${url}" target="_blank" rel="noopener">${title}</a> (${label})</span>`;
}
