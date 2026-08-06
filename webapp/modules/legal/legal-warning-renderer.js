/**
 * Warning renderer for unverified or expired legal documents.
 */
export function renderLegalWarning({ effectiveStatus, verificationStatus, bestAlternative }) {
  if (verificationStatus === 'unverified') {
    return 'Thông tin hiệu lực văn bản chưa được xác minh từ nguồn công báo chính thức. Trạng thái được ghi nhận là [UNKNOWN].';
  }
  if (effectiveStatus === 'het_hieu_luc' || effectiveStatus === 'expired') {
    let msg = 'Văn bản này đã HẾT HIỆU LỰC.';
    if (bestAlternative && bestAlternative.documentNumber) {
      msg += ` Có thể đã được thay thế bởi văn bản số ${bestAlternative.documentNumber}.`;
    }
    return msg;
  }
  return null;
}
