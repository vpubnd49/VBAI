/**
 * Legal Citation Chip & Popover Renderer.
 * Renders inline citation chips with cyan styling, verification badges, and hover popovers.
 */

export function renderCitationChip(citation = {}) {
  const {
    id = '1',
    documentNumber = '',
    title = 'Văn bản pháp luật',
    url = '#',
    sourceTier = 'official',
    effectiveStatus = 'ACTIVE',
    coordinate = null,
  } = citation;

  const isOfficial = sourceTier === 'official';
  const tierClass = isOfficial ? 'chip-official' : 'chip-reference';
  const statusLabel = effectiveStatus === 'EXPIRED' ? 'Hết hiệu lực' : 'Còn hiệu lực';
  const statusClass = effectiveStatus === 'EXPIRED' ? 'status-expired' : 'status-active';

  const coordLabel = coordinate && coordinate.raw ? ` • ${coordinate.raw}` : '';
  const label = documentNumber ? `${documentNumber}${coordLabel}` : title;

  return `
    <span class="legal-citation-chip ${tierClass}" data-citation-id="${id}" tabindex="0">
      <span class="chip-icon">${isOfficial ? '🏛️' : '📄'}</span>
      <span class="chip-text">${label}</span>
      <span class="chip-badge ${statusClass}">${statusLabel}</span>

      <div class="citation-popover">
        <div class="popover-header">
          <span class="popover-badge ${tierClass}">${isOfficial ? 'Nguồn chính thức (VBPL/Chính phủ)' : 'Nguồn tham khảo'}</span>
          <span class="popover-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="popover-title">${title}</div>
        ${documentNumber ? `<div class="popover-docnum">Số hiệu: <strong>${documentNumber}</strong></div>` : ''}
        ${coordLabel ? `<div class="popover-coord">Căn cứ: <strong>${coordLabel.replace(/^ • /, '')}</strong></div>` : ''}
        <div class="popover-footer">
          ${url && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="popover-link">Xem văn bản gốc ↗</a>` : ''}
        </div>
      </div>
    </span>
  `;
}

export function renderCitationBadge({ title = '', url = '#', sourceTier = 'unknown', verified = false } = {}) {
  const isOfficialVerified = sourceTier === 'official' || verified === true;
  const badgeClass = isOfficialVerified ? 'badge-official' : 'badge-reference';
  const label = isOfficialVerified ? 'Nguồn chính thức' : 'Nguồn tham khảo';
  const safeUrl = url || '#';
  return `<span class="legal-citation ${badgeClass}"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${title}</a> (${label})</span>`;
}

export function replaceCitationsWithChips(text = '', citationsMap = {}) {
  if (!text) return '';
  return text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const citation = citationsMap[inner] || citationsMap[match] || { title: inner, raw: match };
    return renderCitationChip(citation);
  });
}
