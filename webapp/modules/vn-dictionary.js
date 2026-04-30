/**
 * Vietnamese Spelling Dictionary — Common errors in administrative documents
 * Format: { wrong: correct }
 */

// Common spelling mistakes in Vietnamese administrative documents
export const SPELLING_ERRORS = {
  // Sai phụ âm đầu
  'sử lý': 'xử lý', 'sử phạt': 'xử phạt', 'sử dụng': 'sử dụng',
  'xu lý': 'xử lý', 'xứ lý': 'xử lý',
  'giám đốt': 'giám đốc', 'giám đốk': 'giám đốc',
  'nghỉ quyết': 'nghị quyết', 'nghị quyếch': 'nghị quyết',
  'dánh giá': 'đánh giá', 'đán giá': 'đánh giá',
  'chấp hàng': 'chấp hành',
  'kết lận': 'kết luận', 'kếch luận': 'kết luận',
  'chỉ đạ': 'chỉ đạo', 'chỉ dạo': 'Chỉ đạo',
  'triển kha': 'triển khai', 'chiển khai': 'triển khai',
  'thực hiệng': 'thực hiện', 'thực hiệm': 'thực hiện',
  'quyết địng': 'quyết định', 'quyếch định': 'quyết định',
  'hướng dẩn': 'hướng dẫn', 'hướg dẫn': 'hướng dẫn',
  'giải quyếch': 'giải quyết', 'giải quyếd': 'giải quyết',
  'tổ chứt': 'tổ chức',
  'phát chiển': 'phát triển', 'phách triển': 'phát triển',
  'quản lí': 'quản lý', 'quảng lý': 'quản lý',
  'kiểm cha': 'kiểm tra',
  'nghiêng cứu': 'nghiên cứu', 'nghiên cưu': 'nghiên cứu',
  'báo cáu': 'báo cáo', 'bảo cáo': 'báo cáo',
  'thống kế': 'thống kê', 'thốn kê': 'thống kê',
  'đào tạu': 'đào tạo', 'đàu tạo': 'đào tạo',
  'bảo đãm': 'bảo đảm', 'bão đảm': 'bảo đảm',
  'chương chình': 'chương trình', 'trương trình': 'chương trình',
  'biêng bản': 'biên bản', 'biên bãn': 'biên bản',
  'trách nhiện': 'trách nhiệm', 'chách nhiệm': 'trách nhiệm',
  'chính sách': 'chính sách', 'chíng sách': 'chính sách',
  'nguyên nhâng': 'nguyên nhân', 'nguyên nhâm': 'nguyên nhân',
  'phương hướn': 'phương hướng', 'phương hướg': 'phương hướng',
  'nhiện vụ': 'nhiệm vụ', 'nhiệm vự': 'nhiệm vụ',
  'giải phát': 'giải pháp', 'giãi pháp': 'giải pháp',
  'đề suất': 'đề xuất', 'đề xuấc': 'đề xuất',
  'nội dun': 'nội dung', 'nộ dung': 'nội dung',
  'công tát': 'công tác', 'côn tác': 'công tác',
  'yêu cầ': 'yêu cầu', 'yêu cần': 'yêu cầu',
  'tiêu chuẫn': 'tiêu chuẩn', 'tiêu chuẩng': 'tiêu chuẩn',
  'phê duyệch': 'phê duyệt', 'phê duyệd': 'phê duyệt',
  'chuẩng bị': 'chuẩn bị', 'chuẩn bì': 'chuẩn bị',
  'đăng ký': 'đăng ký', 'đăn ký': 'đăng ký',
  'giáo dụt': 'giáo dục', 'giáu dục': 'giáo dục',
  'sáng kiếng': 'sáng kiến', 'sán kiến': 'sáng kiến',

  // Sai dấu thanh điệu
  'chính phũ': 'chính phủ', 'chính phú': 'chính phủ',
  'thủ tục': 'thủ tục', 'thũ tục': 'thủ tục',
  'lãnh đạo': 'lãnh đạo', 'lảnh đạo': 'lãnh đạo',
  'cơ quang': 'cơ quan', 'cơ quàn': 'cơ quan',
  'ngân sáck': 'ngân sách', 'ngâng sách': 'ngân sách',
  'đầu tư': 'đầu tư', 'đầu từ': 'đầu tư',
  'dự áng': 'dự án', 'dự àn': 'dự án',
  'cán bộ': 'cán bộ', 'cáng bộ': 'cán bộ',
  'thẩm tra': 'thẩm tra', 'thẫm tra': 'thẩm tra',
  'kỷ luậc': 'kỷ luật', 'kỹ luật': 'kỷ luật',
  'kỹ thuậc': 'kỹ thuật', 'kỷ thuật': 'kỹ thuật',
  'tài chín': 'tài chính', 'tái chính': 'tài chính',
  'phương áng': 'phương án', 'phương àn': 'phương án',
  'hoàn thiệng': 'hoàn thiện', 'hoàng thiện': 'hoàn thiện',
  'quy họach': 'quy hoạch', 'quy hoạch': 'quy hoạch',
  'nhân sư': 'nhân sự', 'nhâng sự': 'nhân sự',
  'thành lâp': 'thành lập', 'thàng lập': 'thành lập',
  'ban hàng': 'ban hành', 'bàn hành': 'ban hành',
  'thi hàng': 'thi hành', 'thì hành': 'thi hành',
  'phạn vi': 'phạm vi', 'phạm vì': 'phạm vi',
  'điều chỉn': 'điều chỉnh', 'điều chỉng': 'điều chỉnh',
  'bổ nhiện': 'bổ nhiệm', 'bổ nhiện': 'bổ nhiệm',
  'miễng nhiệm': 'miễn nhiệm', 'miểm nhiệm': 'miễn nhiệm',
  'luân chuyễn': 'luân chuyển', 'luâng chuyển': 'luân chuyển',
  'nâng cấb': 'nâng cấp', 'nâng câp': 'nâng cấp',
  'kinh phí': 'kinh phí', 'kính phí': 'kinh phí',
  'thông tư': 'thông tư', 'thông từ': 'thông tư',
  'nghĩ định': 'nghị định', 'nghì định': 'nghị định',

  // Sai chính tả phổ biến
  'sơ xuất': 'sơ suất', 'sơ sót': 'sơ suất',
  'dành dụm': 'dành dụm', 'dàng dụm': 'dành dụm',
  'sáng suốc': 'sáng suốt', 'sáng xuốt': 'sáng suốt',
  'vấng đề': 'vấn đề', 'vấn để': 'vấn đề',
  'đáng kể': 'đáng kể', 'đánh kể': 'đáng kể',
  'trung thưc': 'trung thực', 'chung thực': 'trung thực',
  'nghiêm tút': 'nghiêm túc', 'nghiêm túk': 'nghiêm túc',
  'tích cựt': 'tích cực', 'tít cực': 'tích cực',
  'hiệu quã': 'hiệu quả', 'hiệu quá': 'hiệu quả',
  'liêng hệ': 'liên hệ', 'liên hê': 'liên hệ',
  'hợp đông': 'hợp đồng', 'hợp đồn': 'hợp đồng',
  'phối hợb': 'phối hợp', 'phôi hợp': 'phối hợp',
  'kế họach': 'kế hoạch', 'kế hoạch': 'kế hoạch',
  'khẩng trương': 'khẩn trương', 'khẫn trương': 'khẩn trương',
  'đồng ý kiến': 'đồng ý kiến',
  'quyền hành': 'quyền hạn',

  // Lỗi d/gi/r
  'danh giới': 'ranh giới', 'ranh dới': 'ranh giới',
  'dập trung': 'tập trung',
  'dải quyết': 'giải quyết', 'rải quyết': 'giải quyết',
  'dắn bó': 'gắn bó',
  'giao viêng': 'giáo viên',
  'rán bộ': 'cán bộ',

  // Lỗi ch/tr
  'chong đợi': 'trông đợi',
  'chách nhiệm': 'trách nhiệm',
  'chiến khai': 'triển khai',
  'chình bày': 'trình bày', 'trìng bày': 'trình bày',
  'chực tiếp': 'trực tiếp', 'trưc tiếp': 'trực tiếp',
  'chiều hành': 'điều hành',
  'chường hợp': 'trường hợp', 'trương hợp': 'trường hợp',
  'chụ sở': 'trụ sở', 'trụ sỡ': 'trụ sở',

  // Lỗi s/x
  'sây dựng': 'xây dựng', 'xây dưng': 'xây dựng',
  'sác nhận': 'xác nhận', 'xát nhận': 'xác nhận',
  'sem xét': 'xem xét', 'xem xéc': 'xem xét',
  'sắp xếb': 'sắp xếp', 'sắp sếp': 'sắp xếp',
  'sác định': 'xác định', 'xác đình': 'xác định',
  'sung đột': 'xung đột', 'xun đột': 'xung đột',

  // Lỗi n/ng cuối
  'bàn giao': 'bàn giao', 'bàng giao': 'bàn giao',
  'hoàn thàn': 'hoàn thành', 'hoàn thàng': 'hoàn thành',
  'sinh hoạch': 'sinh hoạt',
  'giáo dụng': 'giáo dục',
  'tiếp nhậm': 'tiếp nhận',
  'phân côn': 'phân công', 'phân côg': 'phân công',
  'kiến nghỉ': 'kiến nghị', 'kiến nghì': 'kiến nghị',

  // Lỗi viết tắt sai
  'UB.ND': 'UBND',
  'HĐ.ND': 'HĐND',
  'BTC.CB': 'BTCCB',

  // Lỗi đặc thù từ văn bản thực tế (user-reported)
  'tình hìn': 'tình hình',
  'tìn hình': 'tình hình',
  'tình hìng': 'tình hình',
  'chỉ sô': 'chỉ số',
  'chỉ só': 'chỉ số',
  'chi số': 'chỉ số',

  // Lỗi hàng/hằng (rất phổ biến)
  'hàng tuần': 'hằng tuần',
  'hàng tháng': 'hằng tháng',
  'hàng năm': 'hằng năm',
  'hàng ngày': 'hằng ngày',
  'hàng quý': 'hằng quý',

  // Lỗi thiếu chữ phổ biến
  'cải các': 'cải cách',
  'hành chín': 'hành chính',
  'hành chinh': 'hành chính',
  'công chứ': 'công chức',
  'viên chứ': 'viên chức',
  'chức năn': 'chức năng',
  'quy đình': 'quy định',
  'quy địn': 'quy định',
  'thực hiệ': 'thực hiện',
  'phương phá': 'phương pháp',
  'đáp ưn': 'đáp ứng',
  'đáp ứn': 'đáp ứng',
  'chỉ tiê': 'chỉ tiêu',
  'tiêu chí': 'tiêu chí',
  'kết quà': 'kết quả',

  // Lỗi viết hoa "Nhân dân" riêng lẻ (bắt buộc viết hoa chữ Nhân)
  // LƯU Ý: "Ủy ban nhân dân" và "Hội đồng nhân dân" giữ nguyên chữ thường
  // Chỉ "Nhân dân" đứng riêng mới viết hoa
};

/**
 * Quy tắc viết hoa chức danh và tổ chức (học từ 235 file mẫu thực tế)
 * Dùng để AI và local checker kiểm tra viết hoa đúng chuẩn
 * Format: { sai (lowercase): đúng (đã viết hoa chuẩn) }
 */
export const CAPITALIZATION_RULES = {
  // ===== Tổ chức Đảng/Nhà nước =====
  'ban chấp hành': 'Ban Chấp hành',
  'ban thường vụ': 'Ban Thường vụ',
  'ban thường trực': 'Ban Thường trực',
  'ban tổ chức': 'Ban Tổ chức',
  'ban kiểm tra': 'Ban Kiểm tra',
  'ban kiểm soát': 'Ban Kiểm soát',
  'ban dân vận': 'Ban Dân vận',
  'ban tuyên giáo': 'Ban Tuyên giáo',
  'ban nội chính': 'Ban Nội chính',
  'ban kinh tế': 'Ban Kinh tế',
  'ban chỉ đạo': 'Ban Chỉ đạo',
  'ban quản lý': 'Ban Quản lý',
  'ban vận động': 'Ban Vận động',
  'ban cố vấn': 'Ban Cố vấn',
  'ban vì sự tiến bộ của phụ nữ': 'Ban Vì sự tiến bộ của phụ nữ',

  // ===== Chức danh lãnh đạo =====
  'trưởng ban': 'Trưởng ban',
  'phó trưởng ban': 'Phó Trưởng ban',
  'chủ tịch': 'Chủ tịch',
  'phó chủ tịch': 'Phó Chủ tịch',
  'giám đốc': 'Giám đốc',
  'phó giám đốc': 'Phó Giám đốc',
  'tổng giám đốc': 'Tổng Giám đốc',
  'chánh văn phòng': 'Chánh Văn phòng',
  'phó chánh văn phòng': 'Phó Chánh Văn phòng',
  'chánh thanh tra': 'Chánh Thanh tra',
  'phó chánh thanh tra': 'Phó Chánh Thanh tra',
  'thư ký': 'Thư ký',
  'tổng thư ký': 'Tổng Thư ký',
  'phó thư ký': 'Phó Thư ký',
  'bí thư': 'Bí thư',
  'phó bí thư': 'Phó Bí thư',
  'ủy viên': 'Ủy viên',
  'vụ trưởng': 'Vụ trưởng',
  'phó vụ trưởng': 'Phó Vụ trưởng',
  'cục trưởng': 'Cục trưởng',
  'phó cục trưởng': 'Phó Cục trưởng',
  'trưởng phòng': 'Trưởng phòng',
  'phó trưởng phòng': 'Phó Trưởng phòng',
  'chi cục trưởng': 'Chi cục trưởng',
  'hội trưởng': 'Hội trưởng',
  'chi hội trưởng': 'Chi hội trưởng',
  'thủ trưởng': 'Thủ trưởng',

  // ===== Cơ quan hành chính =====
  // LƯU Ý: "Ủy ban nhân dân" và "Hội đồng nhân dân" giữ nguyên, KHÔNG viết hoa "Nhân"
  'ủy ban nhân dân': 'Ủy ban nhân dân',
  'hội đồng nhân dân': 'Hội đồng nhân dân',
  'ủy ban mặt trận': 'Ủy ban Mặt trận',
  'mặt trận tổ quốc': 'Mặt trận Tổ quốc',
  'đoàn chủ tịch': 'Đoàn Chủ tịch',
  'hội đồng quản lý': 'Hội đồng quản lý',
  'đại hội đại biểu': 'Đại hội đại biểu',

  // ===== Từ quan trọng =====
  // 'nhân dân' riêng lẻ → 'Nhân dân' (xử lý riêng trong checkSpellingLocal, không đặt ở đây
  // vì CAPITALIZATION_RULES dùng toLowerCase match sẽ trùng với "ủy ban nhân dân")
  'thủ tướng chính phủ': 'Thủ tướng Chính phủ',
  'chính phủ': 'Chính phủ',
  'quốc hội': 'Quốc hội',
  'nhà nước': 'Nhà nước',
};

/**
 * Danh sách chức danh/tổ chức đầy đủ dùng cho AI system instruction
 */
export const OFFICIAL_TITLES = [
  // Chức danh
  'Chủ tịch', 'Phó Chủ tịch', 'Trưởng ban', 'Phó Trưởng ban',
  'Giám đốc', 'Phó Giám đốc', 'Tổng Giám đốc',
  'Chánh Văn phòng', 'Phó Chánh Văn phòng',
  'Chánh Thanh tra', 'Phó Chánh Thanh tra',
  'Thư ký', 'Tổng Thư ký', 'Phó Thư ký',
  'Bí thư', 'Phó Bí thư',
  'Ủy viên', 'Vụ trưởng', 'Phó Vụ trưởng',
  'Cục trưởng', 'Phó Cục trưởng',
  'Trưởng phòng', 'Phó Trưởng phòng',
  'Chi cục trưởng', 'Hội trưởng', 'Chi hội trưởng',
  'Thủ trưởng',
  // Tổ chức
  'Ban Chấp hành', 'Ban Thường vụ', 'Ban Thường trực',
  'Ban Tổ chức', 'Ban Kiểm tra', 'Ban Kiểm soát',
  'Ban Dân vận', 'Ban Tuyên giáo', 'Ban Nội chính',
  'Ban Chỉ đạo', 'Ban Quản lý', 'Ban Vận động',
  'Ủy ban nhân dân', 'Hội đồng nhân dân',
  'Ủy ban Mặt trận', 'Mặt trận Tổ quốc',
  'Đoàn Chủ tịch', 'Hội đồng quản lý',
  'Đại hội đại biểu', 'Nhân dân (riêng lẻ)',
  'Chính phủ', 'Quốc hội', 'Nhà nước',
  'Thủ tướng Chính phủ',
];

// Words that are correct but often flagged - whitelist
export const WHITELIST = [
  'UBND', 'HĐND', 'ĐẢNG', 'NĐ30', 'HD36',
  'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
  'ĐẢNG CỘNG SẢN VIỆT NAM',
  'Độc lập', 'Tự do', 'Hạnh phúc',
  // Viết tắt đơn vị tỉnh Lâm Đồng (trích xuất từ 235 file mẫu)
  'SNV', 'STP', 'CAT', 'CCHC', 'KTTH', 'KGVX',
  'TTHC', 'DVCTT', 'PAR INDEX', 'SIPAS', 'PAPI',
  'VPUB', 'BNV', 'TCVN', 'VPUBND', 'VPCP',
  // Viết tắt cơ quan
  'BCH', 'BTV', 'BTC', 'BTT', 'BCĐ', 'BKT', 'BKS',
  'MTTQ', 'MTTQVN', 'MTTW',
  'STC', 'SKHCN', 'SVHTTDL', 'SXD', 'SNNMT', 'STNMT',
  'PCT', 'CVP', 'PCVP', 'BGDĐT', 'CATP', 'CNTT', 'SYT',
  // Viết tắt loại văn bản
  'QĐ', 'NQ', 'TTr', 'CV', 'BC', 'KH', 'TB', 'CT', 'HD',
  'QPPL', 'VBQPPL',
  // Viết tắt chuyên ngành
  'BHXH', 'BHYT', 'BHTN', 'NSNN', 'TMDV',
  'TNHH', 'MTV', 'TMCP', 'CP',
  'CSDL', 'CSDLQG', 'VNEID', 'LGSP', 'QR', 'PKI',
  'CCCD', 'ATTT', 'ANTT', 'ATVSLĐ',
  'PCTT', 'TDTT', 'HTDN', 'DVCQG', 'VPHC', 'TĐKT',
  // Hội/Liên đoàn
  'HHDN', 'HHNM', 'HHVTBT', 'HNDN', 'LĐBB', 'LĐVTCT',
  'LĐTKDL', 'LĐYL', 'LĐCL', 'LĐQV', 'CLB', 'TPL',
  // Tên riêng / Khác
  'PICKLEBALL', 'TAEKWONDO', 'YOGA', 'GOLF', 'KARATE',
  'BILLIARDS', 'SNOOKER', 'VOVINAM', 'GPT', 'HIV', 'KCN', 'MTQG', 'PCMT', 'CQ', 'CSĐT', 'XX',
];

