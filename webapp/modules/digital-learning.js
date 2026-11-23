/**
 * Digital Learning Hub — Góc "Học tập số" & Cẩm nang AI Công vụ (Đầy đủ 5 phân hệ tương tác tại chỗ)
 * Hưởng ứng phong trào "Học tập số" toàn dân theo Nghị quyết 11/NQ-CP ngày 14/01/2026
 */
import { sendChatRequest } from './ai-proxy.js';
import { showToast } from './ui-utils.js';

const PROGRESS_KEY = 'vbai_digital_learning_progress_v1';

const LESSONS = [
  {
    id: 'ls-nq57',
    code: 'Chuyên đề 01',
    duration: '10 phút',
    level: 'Cơ bản',
    title: 'Hệ thống văn bản Nghị quyết 57-NQ/TW, NQ 71/NQ-CP & NQ 11/NQ-CP',
    summary: 'Nắm vững mạch văn bản chỉ đạo về KHCN, ĐMST và CĐS giai đoạn 2024–2026, tránh viện dẫn văn bản đã bị thay thế.',
    keyPoints: [
      'Nghị quyết 57-NQ/TW (ngày 22/12/2024) của Bộ Chính trị là văn bản định hướng chiến lược xuyên suốt.',
      'Nghị quyết 71/NQ-CP (ngày 01/04/2025) đã THAY THẾ Nghị quyết 03/NQ-CP (ngày 09/01/2025).',
      'Nghị quyết 11/NQ-CP (ngày 14/01/2026) tiếp tục SỬA ĐỔI, BỔ SUNG Nghị quyết 71/NQ-CP: giữ mục tiêu kinh tế số ≥ 30% GDP năm 2030, phát động phong trào "Học tập số" toàn dân và cập nhật tiến độ các CSDL quốc gia gắn Đề án 06.',
      'Kế hoạch 02-KH/BCĐTW (ngày 19/06/2025) xác lập nguyên tắc: "Một hệ thống thống nhất – Một dữ liệu duy nhất – Một dịch vụ liền mạch" cho bộ máy chính quyền 2 cấp.',
    ],
    practiceTip: 'Khi soạn báo cáo hoặc tờ trình về CĐS năm 2026, luôn viện dẫn đầy đủ chuỗi: NQ 57-NQ/TW (ngày 22/12/2024) → NQ 71/NQ-CP (ngày 01/04/2025) → NQ 11/NQ-CP (ngày 14/01/2026).',
  },
  {
    id: 'ls-1425',
    code: 'Chuyên đề 02',
    duration: '12 phút',
    level: 'Cơ bản',
    title: 'Khung kiến trúc tổng thể quốc gia số 4 lớp (QĐ 1425/QĐ-TTg)',
    summary: 'Hiểu đúng 4 lớp kiến trúc và 3 nguyên tắc vàng: AI First có kiểm soát, Data-Centric và Security-by-design.',
    keyPoints: [
      'Lớp 1 — Hạ tầng số & An ninh mạng dùng chung: Mạng TSLCD, 5G, bảo vệ dữ liệu & quyền riêng tư từ khâu thiết kế (Security-by-design).',
      'Lớp 2 — Dữ liệu & Nền tảng lõi: Quản trị dữ liệu theo 6 tiêu chí "Đúng – Đủ – Sạch – Sống – Thống nhất – Dùng chung", kết nối 79 nền tảng số quốc gia.',
      'Lớp 3 — Ứng dụng & Nghiệp vụ dùng chung: Ưu tiên tích hợp AI tự động hóa (AI First), nhưng con người luôn là chủ thể kiểm duyệt và quyết định cuối cùng.',
      'Lớp 4 — Kênh tương tác & Đo lường hiệu quả: Cổng DVCQG, VNeID, cổng giám sát nq57.tracuu.lamdong.vn, pakn.nq57.vn và Bộ chỉ số 766.',
    ],
    practiceTip: 'Không tự phát triển phần mềm rời rạc trùng lặp; luôn ưu tiên dùng chung nền tảng, tái sử dụng dữ liệu số đã có.',
  },
  {
    id: 'ls-2cap',
    code: 'Chuyên đề 03',
    duration: '10 phút',
    level: 'Nghiệp vụ',
    title: 'Chính quyền 2 cấp & Cơ cấu 6 Sở mới tỉnh Lâm Đồng',
    summary: 'Phân định đúng thẩm quyền cấp Tỉnh và cấp Xã/Phường/Đặc khu; sử dụng đúng tên gọi 6 Sở mới từ ngày 01/03/2025.',
    keyPoints: [
      'Luật Tổ chức chính quyền địa phương số 72/2025/QH15 xóa bỏ cấp hành chính trung gian cấp huyện, tổ chức gọn theo 2 cấp: Tỉnh và Xã/Phường/Đặc khu.',
      'Nghị quyết 390–395/NQ-HĐND tỉnh Lâm Đồng (thông qua ngày 18/02/2025, vận hành từ ngày 01/03/2025) hình thành 6 Sở mới: Sở Tài chính, Sở Xây dựng, Sở Nông nghiệp và Môi trường, Sở Khoa học và Công nghệ, Sở Nội vụ, Sở Dân tộc và Tôn giáo.',
      'Chức năng quản lý nhà nước về tôn giáo chuyển từ Sở Nội vụ sang Sở Dân tộc và Tôn giáo (NQ 395/NQ-HĐND).',
      'Khi chuyển xử lý Phản ánh kiến nghị (pakn.nq57.vn) hoặc giao việc, phải ghi đúng tên Sở mới, không dùng tên Sở cũ (như Sở TN&MT, Sở KH&ĐT, Sở TT&TT, Sở GTVT, Sở LĐTB&XH).',
    ],
    practiceTip: 'Mọi văn bản ban hành từ ngày 01/03/2025 trở đi bắt buộc sử dụng tên 6 Sở mới và cấp Xã/Phường/Đặc khu.',
  },
  {
    id: 'ls-security',
    code: 'Chuyên đề 04',
    duration: '15 phút',
    level: 'Bắt buộc',
    title: 'An toàn thông tin & Bảo vệ bí mật nhà nước khi sử dụng AI',
    summary: 'Nguyên tắc sống còn giúp cán bộ sử dụng Trợ lý AI hiệu quả mà tuyệt đối không lộ lọt bí mật nhà nước hay dữ liệu cá nhân.',
    keyPoints: [
      'TUYỆT ĐỐI CẤM tải lên hoặc dán nội dung văn bản đóng dấu MẬT, TỐI MẬT, TUYỆT MẬT hoặc mang ký hiệu mật (.../UBND-M, ...-TM) lên bất kỳ AI đám mây nào.',
      'Che ẩn thông tin định danh cá nhân (PII): CCCD 12 chữ số, số điện thoại cá nhân, số tài khoản ngân hàng, hồ sơ bệnh án trước khi gửi AI phân tích.',
      'Luôn đối chiếu lại số hiệu văn bản, ngày ban hành, hiệu lực pháp lý từ nguồn chính thống (vanban.chinhphu.vn, vbpl.vn) trước khi trình ký.',
      'VBAI đã tích hợp lớp Security Guard tự động chặn cứng tài liệu mật và ẩn danh PII ngay tại tầng Proxy.',
    ],
    practiceTip: 'Ghi nhớ quy tắc 3 KHÔNG: Không đưa văn bản Mật — Không lộ PII công dân — Không trình ký khi chưa rà soát 7 lớp.',
  },
  {
    id: 'ls-prompt',
    code: 'Chuyên đề 05',
    duration: '12 phút',
    level: 'Thực hành',
    title: 'Kỹ năng viết Prompt công vụ & Chuẩn thể thức NĐ30 / HD05',
    summary: 'Công thức 5 yếu tố viết câu lệnh (Prompt) để AI soạn dự thảo văn bản sát thực tiễn ngay từ lần đầu.',
    keyPoints: [
      'Công thức 5 yếu tố: [1. Vai trò/Cơ quan] + [2. Loại văn bản NĐ30/HD05] + [3. Căn cứ/Bối cảnh] + [4. Yêu cầu giao việc cụ thể: Chủ trì – Phối hợp – Sản phẩm – Hạn DD/MM/YYYY] + [5. Quy chuẩn thể thức].',
      'Quy chuẩn ngày văn bản thống nhất toàn hệ thống VBAI: Bắt buộc định dạng "ngày DD/MM/YYYY" (VD: ngày 23/10/2026), không viết dài "ngày 23 tháng 10 năm 2026".',
      'Phân biệt rõ thể thức NĐ30 (TM., KT., TL., Nơi nhận nghiêng đậm) và Văn bản Đảng HD05 (T/M, K/T, T/L dùng gạch chéo, Nơi nhận gạch chân, Tờ trình dùng "Kính trình").',
      'Dấu kết thúc văn bản hành chính ./. luôn gắn liền từ cuối cùng, không tách dòng riêng.',
    ],
    practiceTip: 'Thực hành ngay công thức 5 yếu tố tại Tab "Phòng Thực hành AI" bên cạnh để được chấm điểm và góp ý tự động.',
  },
  {
    id: 'ls-portal',
    code: 'Chuyên đề 06',
    duration: '10 phút',
    level: 'Vận hành',
    title: 'Vận hành cổng nq57.tracuu.lamdong.vn, Đôn đốc nhiệm vụ & Chế độ NĐ 179',
    summary: 'Quy trình khép kín từ bóc băng cuộc họp → đôn đốc nhiệm vụ → tổng hợp báo cáo Sở/Xã → cập nhật cổng NQ 57 Lâm Đồng.',
    keyPoints: [
      'Cổng giám sát Nghị quyết 57 tỉnh Lâm Đồng hoạt động tại địa chỉ https://nq57.tracuu.lamdong.vn/.',
      'Chuỗi nghiệp vụ chuẩn trên VBAI: (1) Ghi âm/Bóc băng cuộc họp → (2) Bấm "Đẩy sang Đôn đốc NQ 57" → (3) Tổng hợp báo cáo đa đơn vị Sở/Xã → (4) Xuất phụ lục CSV/DOCX nhập lên cổng NQ 57.',
      'Chế độ hỗ trợ cán bộ chuyên trách CĐS, ATTT, ANM: 5.000.000 đồng/người/tháng theo Nghị định 179/2025/NĐ-CP (ngày 01/07/2025) và Thông tư 23/2025/TT-BKHCN (ngày 20/10/2025).',
      'Bộ chỉ số 766 tỉnh Lâm Đồng (snapshot 2025): 90,09/100 điểm (xếp hạng 11/34 tỉnh/thành).',
    ],
    practiceTip: 'Thường xuyên kiểm tra nhiệm vụ sắp quá hạn (≤ 3 ngày) tại mục "Đôn đốc NQ 57 & CĐS" để kịp thời nhắc đơn vị chủ trì.',
  },
];

const PROMPT_LIBRARY = [
  {
    group: 'Báo cáo NQ 57',
    title: 'Soạn Công văn đôn đốc cập nhật tiến độ lên nq57.tracuu.lamdong.vn',
    prompt: 'Trong vai chuyên viên Văn phòng UBND tỉnh Lâm Đồng, hãy soạn dự thảo Công văn hành chính chuẩn NĐ30 (ngày 23/11/2026) đôn đốc 6 Sở mới và UBND các xã, phường, đặc khu khẩn trương cập nhật tiến độ nhiệm vụ Nghị quyết 57-NQ/TW lên cổng https://nq57.tracuu.lamdong.vn/ trước ngày 30/11/2026. Nêu rõ trách nhiệm người đứng đầu và chế độ báo cáo.',
  },
  {
    group: 'Báo cáo NQ 57',
    title: 'Phân tích điểm mới Nghị quyết 11/NQ-CP so với Nghị quyết 71/NQ-CP',
    prompt: 'Lập bảng so sánh các điểm sửa đổi, bổ sung trọng tâm của Nghị quyết 11/NQ-CP ngày 14/01/2026 so với Nghị quyết 71/NQ-CP ngày 01/04/2025 về chỉ tiêu Phụ lục I, nhiệm vụ Phụ lục II và phong trào Học tập số. Đề xuất 5 việc cần làm ngay ở cấp xã/phường.',
  },
  {
    group: 'Chuyên viên Sở',
    title: 'Tờ trình triển khai Khung kiến trúc số 4 lớp (QĐ 1425/QĐ-TTg)',
    prompt: 'Soạn dự thảo Tờ trình của Sở Khoa học và Công nghệ trình UBND tỉnh Lâm Đồng về việc ban hành Kế hoạch triển khai Khung kiến trúc tổng thể quốc gia số phiên bản 1.0 theo Quyết định 1425/QĐ-TTg ngày 29/07/2026, chia rõ nhiệm vụ theo 4 lớp kiến trúc và mốc thời gian DD/MM/YYYY.',
  },
  {
    group: 'Cán bộ Xã/Phường',
    title: 'Kế hoạch phát động phong trào "Học tập số" tại cấp xã',
    prompt: 'Soạn dự thảo Kế hoạch của UBND phường/xã triển khai phong trào "Học tập số" toàn dân theo Nghị quyết 11/NQ-CP ngày 14/01/2026, tập trung phổ cập kỹ năng dịch vụ công trực tuyến toàn trình, VNeID và sử dụng Trợ lý AI an toàn cho cán bộ và Tổ công nghệ số cộng đồng.',
  },
  {
    group: 'Chế độ & Nhân lực',
    title: 'Rà soát điều kiện hưởng hỗ trợ 5 triệu/tháng theo NĐ 179/2025/NĐ-CP',
    prompt: 'Lập checklist điều kiện, đối tượng và hồ sơ cần chuẩn bị để đề xuất chi trả mức hỗ trợ 5.000.000 đồng/tháng cho cán bộ chuyên trách chuyển đổi số theo Nghị định 179/2025/NĐ-CP ngày 01/07/2025 và Thông tư 23/2025/TT-BKHCN ngày 20/10/2025.',
  },
  {
    group: 'Rà soát NĐ30/HD05',
    title: 'Kiểm tra thể thức & logic giao việc trước khi trình ký',
    prompt: 'Hãy nêu checklist 7 lớp rà soát một dự thảo Công văn chỉ đạo của UBND tỉnh trước khi trình ký, đặc biệt lưu ý lỗi dùng tên Sở cũ, lỗi sai thẩm quyền ký (TM./KT./TL.), lỗi định dạng ngày văn bản (bắt buộc ngày DD/MM/YYYY) và lỗi thiếu đầu mối chủ trì.',
  },
];

const QUIZ_QUESTIONS = [
  {
    q: 'Nghị quyết số 11/NQ-CP ngày 14/01/2026 của Chính phủ có mối quan hệ pháp lý gì với Nghị quyết 71/NQ-CP ngày 01/04/2025?',
    options: [
      'Bãi bỏ hoàn toàn Nghị quyết 71/NQ-CP và quay lại dùng Nghị quyết 03/NQ-CP',
      'Sửa đổi, bổ sung, cập nhật một số chỉ tiêu (Phụ lục I) và nhiệm vụ trọng tâm (Phụ lục II) của Nghị quyết 71/NQ-CP',
      'Chỉ áp dụng cho các Bộ ở Trung ương, không áp dụng cho UBND cấp tỉnh',
      'Không liên quan đến Nghị quyết 57-NQ/TW',
    ],
    answer: 1,
    explain: 'Nghị quyết 11/NQ-CP ngày 14/01/2026 sửa đổi, bổ sung, cập nhật Nghị quyết 71/NQ-CP (văn bản đã thay thế NQ 03/NQ-CP) để bám sát thực tiễn triển khai NQ 57-NQ/TW.',
  },
  {
    q: 'Theo Quyết định 1425/QĐ-TTg ngày 29/07/2026, Khung kiến trúc tổng thể quốc gia số (phiên bản 1.0) gồm mấy lớp và nguyên tắc "AI First" được hiểu đúng như thế nào?',
    options: [
      '3 lớp; AI tự động ký và ban hành văn bản không cần con người duyệt',
      '4 lớp; Ưu tiên tích hợp AI tự động hóa nhưng có kiểm soát, con người là chủ thể quyết định cuối cùng',
      '5 lớp; Chỉ áp dụng AI cho doanh nghiệp tư nhân',
      '2 lớp; Không cần kết nối các nền tảng số quốc gia',
    ],
    answer: 1,
    explain: 'QĐ 1425/QĐ-TTg quy định cấu trúc 4 lớp và nguyên tắc "AI First có kiểm soát" — AI hỗ trợ mạnh mẽ nhưng con người luôn kiểm duyệt và quyết định cuối cùng.',
  },
  {
    q: 'Trong hệ thống VBAI, định dạng ngày văn bản nào sau đây là ĐÚNG chuẩn đã cấu hình?',
    options: [
      'Lâm Đồng, ngày 23 tháng 10 năm 2026',
      'Lâm Đồng, 2026-10-23',
      'Lâm Đồng, ngày 23/10/2026',
      'Lâm Đồng, ngày 23 tháng Mười năm 2026',
    ],
    answer: 2,
    explain: 'Toàn bộ tri thức, bot và bộ sinh DOCX của VBAI đã chuẩn hóa thống nhất định dạng "ngày DD/MM/YYYY" (ví dụ: ngày 23/10/2026).',
  },
  {
    q: 'Theo Nghị quyết 395/NQ-HĐND tỉnh Lâm Đồng (ngày 18/02/2025), cơ quan nào tiếp nhận chức năng quản lý nhà nước về tôn giáo từ ngày 01/03/2025?',
    options: [
      'Sở Nội vụ',
      'Sở Dân tộc và Tôn giáo',
      'Sở Văn hóa, Thể thao và Du lịch',
      'Văn phòng UBND tỉnh',
    ],
    answer: 1,
    explain: 'Sở Dân tộc và Tôn giáo tiếp nhận chức năng, nhiệm vụ và tổ chức bộ máy quản lý nhà nước về tôn giáo từ Sở Nội vụ theo Nghị quyết 395/NQ-HĐND.',
  },
  {
    q: 'Khi cần xử lý một dự thảo văn bản có đóng dấu "TỐI MẬT", cán bộ phải làm gì?',
    options: [
      'Dán toàn bộ nội dung lên Chatbot AI đám mây để tóm tắt cho nhanh',
      'Chụp ảnh gửi qua OCR online',
      'TUYỆT ĐỐI KHÔNG đưa lên AI đám mây; xử lý hoàn toàn trên máy tính/mạng chuyên dùng theo quy định bảo vệ bí mật nhà nước',
      'Đổi chữ "TỐI MẬT" thành "NỘI BỘ" rồi gửi lên AI',
    ],
    answer: 2,
    explain: 'Theo nguyên tắc Security-by-design và Luật Bảo vệ bí mật nhà nước, tuyệt đối không đưa tài liệu mật lên AI cloud dưới mọi hình thức.',
  },
  {
    q: 'Mức hỗ trợ đối với người làm công tác chuyên trách về chuyển đổi số, an toàn thông tin mạng, an ninh mạng theo Nghị định 179/2025/NĐ-CP là bao nhiêu?',
    options: [
      '2.000.000 đồng/người/tháng',
      '3.500.000 đồng/người/tháng',
      '5.000.000 đồng/người/tháng (không dùng tính đóng, hưởng BHXH, BHYT)',
      '10.000.000 đồng/người/tháng',
    ],
    answer: 2,
    explain: 'Nghị định 179/2025/NĐ-CP ngày 01/07/2025 quy định mức hỗ trợ 5.000.000 đồng/người/tháng chi trả cùng kỳ lương, hướng dẫn bởi Thông tư 23/2025/TT-BKHCN.',
  },
  {
    q: 'Nguyên tắc cốt lõi của Kế hoạch 02-KH/BCĐTW ngày 19/06/2025 phục vụ sắp xếp bộ máy chính quyền 2 cấp là gì?',
    options: [
      'Mỗi xã tự xây một phần mềm riêng',
      'Một hệ thống thống nhất – Một dữ liệu duy nhất – Một dịch vụ liền mạch',
      'Chỉ số hóa ở cấp tỉnh, cấp xã giữ hồ sơ giấy',
      'Không cần tái sử dụng dữ liệu số',
    ],
    answer: 1,
    explain: 'Kế hoạch 02-KH/BCĐTW định hướng "Một hệ thống thống nhất – Một dữ liệu duy nhất – Một dịch vụ liền mạch" nhằm tránh đầu tư phân tán.',
  },
  {
    q: 'Địa chỉ Cổng giám sát, đánh giá triển khai Nghị quyết 57 của tỉnh Lâm Đồng là gì?',
    options: [
      'https://nq57.tracuu.lamdong.vn/',
      'https://vbai-419728335518.asia-southeast1.run.app',
      'https://localhost:8080',
      'https://example.gov.vn',
    ],
    answer: 0,
    explain: 'Cổng giám sát Nghị quyết 57 tỉnh Lâm Đồng vận hành tại https://nq57.tracuu.lamdong.vn/.',
  },
];

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return {
      completedLessons: Array.isArray(raw.completedLessons) ? raw.completedLessons : [],
      bestQuizScore: Number(raw.bestQuizScore || 0),
      quizAttempts: Number(raw.quizAttempts || 0),
      sandboxRuns: Number(raw.sandboxRuns || 0),
    };
  } catch (_) {
    return { completedLessons: [], bestQuizScore: 0, quizAttempts: 0, sandboxRuns: 0 };
  }
}

function saveProgress(prog) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(prog));
  } catch (_) {}
}

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function analyzePromptQuality(promptText = '') {
  const txt = String(promptText || '').trim();
  const warnings = [];
  if (/(?:TỐI\s+MẬT|TUYỆT\s+MẬT|ĐỘ\s*MẬT\s*[:\-]|\/UBND-M\b)/i.test(txt)) {
    warnings.push('🚨 PHÁT HIỆN DẤU HIỆU TÀI LIỆU MẬT — Không được gửi lên AI đám mây!');
  }
  if (/\b0\d{11}\b/.test(txt) || /(?:\+84|0)(?:3|5|7|8|9)\d{8}\b/.test(txt)) {
    warnings.push('⚠️ Có số CCCD hoặc SĐT cá nhân — hệ thống Proxy sẽ tự động che ẩn PII trước khi xử lý.');
  }
  let score = 40;
  if (txt.length >= 60) score += 15;
  if (/vai trò|chuyên viên|lãnh đạo|ubnd|sở|xã|phường/i.test(txt)) score += 15;
  if (/công văn|tờ trình|báo cáo|kế hoạch|nghị quyết|quyết định|bảng so sánh|checklist/i.test(txt)) score += 15;
  if (/ngày\s+\d{1,2}\/\d{1,2}\/\d{4}|nđ30|hd05|57-nq|11\/nq-cp|1425/i.test(txt)) score += 15;
  return { score: Math.min(100, score), warnings };
}

export function renderDigitalLearning(container) {
  const state = {
    activeTab: 'courses', // courses | sandbox | quiz | prompts | handbook
    selectedLessonId: LESSONS[0].id,
    progress: loadProgress(),
    promptGroupFilter: 'Tất cả',
    sandboxPrompt: PROMPT_LIBRARY[0].prompt,
    sandboxMode: 'soan_thao',
    sandboxRunning: false,
    sandboxOutput: '',
    sandboxError: '',
    quizAnswers: {},
    quizSubmitted: false,
  };

  function getCompletionPercent() {
    return Math.round((state.progress.completedLessons.length / LESSONS.length) * 100);
  }

  function renderCoursesTab() {
    const lesson = LESSONS.find((l) => l.id === state.selectedLessonId) || LESSONS[0];
    const isDone = state.progress.completedLessons.includes(lesson.id);
    return `
      <div style="display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:16px;align-items:start;">
        <div class="panel-group" style="margin:0;padding:12px;">
          <div style="font-weight:700;font-size:0.95rem;margin-bottom:10px;color:#0f766e;">Danh mục 6 Chuyên đề (${state.progress.completedLessons.length}/${LESSONS.length} hoàn thành)</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${LESSONS.map((l) => {
              const active = l.id === lesson.id;
              const done = state.progress.completedLessons.includes(l.id);
              return `
                <button type="button" class="dl-select-lesson" data-id="${l.id}" style="text-align:left;padding:10px 12px;border-radius:8px;cursor:pointer;border:1px solid ${active ? '#0f766e' : 'var(--border-color)'};background:${active ? '#f0fdfa' : 'var(--bg-card,#fff)'};">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:var(--text-muted);margin-bottom:3px;">
                    <span>${l.code} · ${l.duration}</span>
                    <span style="font-weight:700;color:${done ? '#059669' : '#64748b'};">${done ? '✓ Đã học' : l.level}</span>
                  </div>
                  <div style="font-weight:600;font-size:0.9rem;color:var(--text-main);line-height:1.35;">${escapeHtml(l.title)}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="panel-group" style="margin:0;">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border-color);">
            <div>
              <span style="display:inline-block;padding:2px 10px;border-radius:999px;background:#f0fdfa;color:#0f766e;font-size:0.8rem;font-weight:700;">${lesson.code} · ${lesson.level} · ${lesson.duration}</span>
              <h3 style="margin:6px 0 0;font-size:1.18rem;">${escapeHtml(lesson.title)}</h3>
            </div>
            <button type="button" class="btn ${isDone ? 'btn-secondary' : 'btn-success'}" id="dl-toggle-done" data-id="${lesson.id}">
              ${isDone ? '✓ Đã hoàn thành bài học' : '✓ Đánh dấu hoàn thành'}
            </button>
          </div>
          <p style="font-size:0.95rem;color:var(--text-muted);margin:0 0 14px;">${escapeHtml(lesson.summary)}</p>
          <div style="margin-bottom:14px;">
            <strong style="font-size:0.95rem;color:#0f766e;">📌 Nội dung cốt lõi cần nắm:</strong>
            <ul style="margin:8px 0 0;padding-left:20px;line-height:1.7;font-size:0.94rem;">
              ${lesson.keyPoints.map((pt) => `<li style="margin-bottom:6px;">${escapeHtml(pt)}</li>`).join('')}
            </ul>
          </div>
          <div style="padding:12px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:0.9rem;margin-bottom:14px;">
            <strong>💡 Kinh nghiệm áp dụng thực tế:</strong> ${escapeHtml(lesson.practiceTip)}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="dl-practice-this">🧪 Thực hành AI ngay cho chuyên đề này →</button>
            <button type="button" class="btn btn-secondary" id="dl-goto-quiz">📝 Làm bài trắc nghiệm kiểm tra →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSandboxTab() {
    const check = analyzePromptQuality(state.sandboxPrompt);
    return `
      <div class="panel-group" style="margin:0;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0;font-size:1.12rem;">🧪 Phòng Thực hành AI Công vụ (Chạy trực tiếp tại chỗ)</h3>
            <p style="margin:4px 0 0;font-size:0.88rem;color:var(--text-muted);">Luyện viết câu lệnh (Prompt), kiểm tra điểm chất lượng, kiểm tra an toàn Mật/PII và xem AI trả lời ngay tại đây — không chuyển trang.</p>
          </div>
          <span style="padding:4px 12px;border-radius:999px;font-size:0.85rem;font-weight:700;background:${check.score >= 80 ? '#ecfdf5' : '#fffbeb'};color:${check.score >= 80 ? '#059669' : '#d97706'};">Điểm chất lượng Prompt: ${check.score}/100</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Chế độ thực hành</label>
            <select class="form-input" id="dl-sb-mode">
              <option value="soan_thao" ${state.sandboxMode === 'soan_thao' ? 'selected' : ''}>Soạn thảo dự thảo chuẩn NĐ30 / ngày DD/MM/YYYY</option>
              <option value="phan_tich" ${state.sandboxMode === 'phan_tich' ? 'selected' : ''}>Tra cứu & Phân tích chính sách NQ 57 / QĐ 1425</option>
              <option value="cham_diem" ${state.sandboxMode === 'cham_diem' ? 'selected' : ''}>Nhờ AI góp ý & tối ưu hóa câu lệnh của tôi</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nạp nhanh bài tập mẫu</label>
            <select class="form-input" id="dl-sb-preset">
              <option value="">-- Chọn tình huống thực hành mẫu --</option>
              ${PROMPT_LIBRARY.map((p, i) => `<option value="${i}">${escapeHtml(p.title)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Câu lệnh thực hành (Prompt)</label>
          <textarea class="form-textarea" id="dl-sb-input" rows="4" placeholder="Nhập câu lệnh công vụ bạn muốn thực hành (áp dụng công thức 5 yếu tố)...">${escapeHtml(state.sandboxPrompt)}</textarea>
        </div>

        ${check.warnings.length ? `
          <div style="margin-top:8px;padding:10px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:0.88rem;">
            ${check.warnings.map((w) => `<div>${escapeHtml(w)}</div>`).join('')}
          </div>
        ` : ''}

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button type="button" class="btn btn-primary" id="dl-sb-run" ${state.sandboxRunning ? 'disabled' : ''}>
            ${state.sandboxRunning ? '⏳ AI đang xử lý thực hành...' : '▶ Chạy thực hành ngay tại đây'}
          </button>
          <button type="button" class="btn btn-secondary" id="dl-sb-copy">📋 Sao chép Prompt</button>
          <button type="button" class="btn btn-secondary" id="dl-sb-clear">Xóa nội dung</button>
        </div>

        ${state.sandboxError ? `
          <div style="margin-top:14px;padding:12px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;font-size:0.9rem;">
            <strong>Kết quả kiểm tra bảo mật / lỗi:</strong> ${escapeHtml(state.sandboxError)}
          </div>
        ` : ''}

        ${state.sandboxOutput ? `
          <div style="margin-top:16px;padding:16px;border-radius:10px;background:var(--bg-secondary,#f8fafc);border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="color:#0f766e;">✨ Kết quả thực hành từ Trợ lý AI:</strong>
              <button type="button" class="btn btn-sm btn-secondary" id="dl-sb-copy-out">📋 Sao chép kết quả</button>
            </div>
            <div style="white-space:pre-wrap;line-height:1.65;font-size:0.94rem;">${escapeHtml(state.sandboxOutput)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderQuizTab() {
    let correctCount = 0;
    if (state.quizSubmitted) {
      QUIZ_QUESTIONS.forEach((q, idx) => {
        if (Number(state.quizAnswers[idx]) === q.answer) correctCount += 1;
      });
    }
    const passed = state.quizSubmitted && correctCount >= 6;
    return `
      <div class="panel-group" style="margin:0;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0;font-size:1.12rem;">📝 Trắc nghiệm Kiểm tra Kiến thức Số & NQ 57 (${QUIZ_QUESTIONS.length} câu)</h3>
            <p style="margin:4px 0 0;font-size:0.88rem;color:var(--text-muted);">Đạt từ <strong>6/${QUIZ_QUESTIONS.length} câu</strong> trở lên để nhận xác nhận hoàn thành Học tập số nội bộ.</p>
          </div>
          <div style="font-size:0.88rem;color:#0f766e;font-weight:700;">Điểm cao nhất: ${state.progress.bestQuizScore}/${QUIZ_QUESTIONS.length} (${state.progress.quizAttempts} lượt thi)</div>
        </div>

        ${state.quizSubmitted ? `
          <div style="padding:14px 16px;border-radius:10px;margin-bottom:16px;background:${passed ? '#ecfdf5' : '#fffbeb'};border:1px solid ${passed ? '#6ee7b7' : '#fde68a'};">
            <div style="font-size:1.05rem;font-weight:800;color:${passed ? '#065f46' : '#92400e'};">
              ${passed ? `🎉 Chúc mừng! Bạn đạt ${correctCount}/${QUIZ_QUESTIONS.length} điểm — ĐẠT CHUẨN HỌC TẬP SỐ NQ 57` : `📊 Bạn đạt ${correctCount}/${QUIZ_QUESTIONS.length} điểm — Hãy xem giải thích bên dưới và thử lại!`}
            </div>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-primary" id="dl-quiz-retry">🔄 Làm lại bài kiểm tra</button>
              ${passed ? `<button type="button" class="btn btn-sm btn-success" id="dl-quiz-print">🖨️ In phiếu xác nhận hoàn thành</button>` : ''}
            </div>
          </div>
        ` : ''}

        <div style="display:flex;flex-direction:column;gap:14px;">
          ${QUIZ_QUESTIONS.map((item, idx) => {
            const chosen = state.quizAnswers[idx];
            return `
              <div style="padding:14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-card,#fff);">
                <div style="font-weight:700;margin-bottom:8px;font-size:0.95rem;">Câu ${idx + 1}: ${escapeHtml(item.q)}</div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                  ${item.options.map((opt, oIdx) => {
                    const isChecked = Number(chosen) === oIdx;
                    let bg = 'transparent';
                    if (state.quizSubmitted) {
                      if (oIdx === item.answer) bg = '#ecfdf5';
                      else if (isChecked && oIdx !== item.answer) bg = '#fef2f2';
                    }
                    return `
                      <label style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:${bg};font-size:0.9rem;">
                        <input type="radio" name="dl_q_${idx}" value="${oIdx}" class="dl-quiz-opt" data-q="${idx}" ${isChecked ? 'checked' : ''} ${state.quizSubmitted ? 'disabled' : ''}>
                        <span>${escapeHtml(opt)}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
                ${state.quizSubmitted ? `<div style="margin-top:8px;font-size:0.85rem;color:#0f766e;"><strong>Giải thích:</strong> ${escapeHtml(item.explain)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${!state.quizSubmitted ? `
          <div style="margin-top:16px;text-align:center;">
            <button type="button" class="btn btn-success" id="dl-quiz-submit">✓ Nộp bài & Chấm điểm ngay</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderPromptsTab() {
    const groups = ['Tất cả', ...new Set(PROMPT_LIBRARY.map((p) => p.group))];
    const filtered = state.promptGroupFilter === 'Tất cả'
      ? PROMPT_LIBRARY
      : PROMPT_LIBRARY.filter((p) => p.group === state.promptGroupFilter);

    return `
      <div class="panel-group" style="margin:0;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">
          <h3 style="margin:0;font-size:1.12rem;">🛠️ Kho Câu lệnh (Prompt) Công vụ chuẩn hóa</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${groups.map((g) => `
              <button type="button" class="btn btn-sm ${state.promptGroupFilter === g ? 'btn-primary' : 'btn-secondary'} dl-filter-group" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>
            `).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px;">
          ${filtered.map((item) => {
            const origIdx = PROMPT_LIBRARY.indexOf(item);
            return `
              <div style="border:1px solid var(--border-color);border-radius:10px;padding:14px;background:var(--bg-card,#fff);display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
                <div>
                  <div style="font-size:0.78rem;font-weight:700;color:#0f766e;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(item.group)}</div>
                  <div style="font-weight:700;font-size:0.96rem;margin-bottom:6px;">${escapeHtml(item.title)}</div>
                  <div style="font-size:0.86rem;color:var(--text-muted);line-height:1.5;">"${escapeHtml(item.prompt)}"</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm btn-primary dl-run-in-sandbox" data-idx="${origIdx}">🧪 Chạy trong Phòng Thực hành</button>
                  <button type="button" class="btn btn-sm btn-secondary dl-copy-tpl" data-idx="${origIdx}">📋 Sao chép</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderHandbookTab() {
    return `
      <div style="display:grid;gap:16px;">
        <div class="panel-group" style="margin:0;border-left:4px solid #dc2626;background:#fef2f2;">
          <h3 style="margin:0 0 10px;font-size:1.05rem;color:#991b1b;">🛡️ Cẩm nang An toàn AI trong Cơ quan Nhà nước (Security-by-design)</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;font-size:0.9rem;">
            <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #bbf7d0;">
              <strong style="color:#065f46;">✅ NÊN LÀM</strong>
              <ul style="margin:6px 0 0;padding-left:18px;line-height:1.6;">
                <li>Dùng AI tóm tắt văn bản công khai, soạn dự thảo công văn, báo cáo, tờ trình NĐ30/HD05.</li>
                <li>Dùng định dạng ngày thống nhất <code>ngày DD/MM/YYYY</code> (VD: ngày 23/11/2026).</li>
                <li>Luôn đối chiếu căn cứ pháp lý gốc và tự rà soát 7 lớp trước khi trình ký.</li>
                <li>Cập nhật tiến độ nhiệm vụ lên <a href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="color:#0f766e;font-weight:700;">nq57.tracuu.lamdong.vn</a>.</li>
              </ul>
            </div>
            <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #fecaca;">
              <strong style="color:#991b1b;">⛔ TUYỆT ĐỐI CẤM</strong>
              <ul style="margin:6px 0 0;padding-left:18px;line-height:1.6;">
                <li>Đưa tài liệu đóng dấu <strong>MẬT / TỐI MẬT / TUYỆT MẬT</strong> lên AI đám mây.</li>
                <li>Dán danh sách chứa CCCD 12 số, STK ngân hàng, thông tin nhạy cảm chưa ẩn danh.</li>
                <li>Tin tuyệt đối vào số hiệu/ngày ban hành do AI tự sinh mà không đối chiếu nguồn.</li>
                <li>Dùng tên Sở cũ hoặc cấp hành chính cấp huyện trong văn bản mới từ năm 2025–2026.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="panel-group" style="margin:0;">
          <h3 style="margin:0 0 10px;font-size:1.05rem;">🏛️ Bảng tra nhanh 6 Sở mới tỉnh Lâm Đồng (NQ 390–395/NQ-HĐND ngày 18/02/2025)</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
              <thead>
                <tr style="border-bottom:2px solid var(--border-color);text-align:left;">
                  <th style="padding:8px;">Tên Sở mới (từ ngày 01/03/2025)</th>
                  <th style="padding:8px;">Nghị quyết thành lập</th>
                  <th style="padding:8px;">Cơ cấu hợp nhất / Tiếp nhận</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px;font-weight:600;">Sở Tài chính</td><td style="padding:8px;">390/NQ-HĐND</td><td style="padding:8px;">Hợp nhất Sở Tài chính + Sở Kế hoạch và Đầu tư</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px;font-weight:600;">Sở Xây dựng</td><td style="padding:8px;">391/NQ-HĐND</td><td style="padding:8px;">Hợp nhất Sở Xây dựng + Sở Giao thông vận tải</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px;font-weight:600;">Sở Nông nghiệp và Môi trường</td><td style="padding:8px;">392/NQ-HĐND</td><td style="padding:8px;">Hợp nhất Sở Nông nghiệp & PTNT + Sở Tài nguyên và Môi trường</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px;font-weight:600;">Sở Khoa học và Công nghệ</td><td style="padding:8px;">393/NQ-HĐND</td><td style="padding:8px;">Hợp nhất Sở Khoa học & Công nghệ + Sở Thông tin và Truyền thông</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px;font-weight:600;">Sở Nội vụ</td><td style="padding:8px;">394/NQ-HĐND</td><td style="padding:8px;">Hợp nhất Sở Nội vụ + Sở Lao động - Thương binh và Xã hội</td></tr>
                <tr><td style="padding:8px;font-weight:600;">Sở Dân tộc và Tôn giáo</td><td style="padding:8px;">395/NQ-HĐND</td><td style="padding:8px;">Ban Dân tộc tiếp nhận thêm chức năng quản lý nhà nước về tôn giáo từ Sở Nội vụ</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const pct = getCompletionPercent();
    const tabs = [
      { id: 'courses', label: `📚 Khóa học (${state.progress.completedLessons.length}/${LESSONS.length})` },
      { id: 'sandbox', label: '🧪 Phòng Thực hành AI' },
      { id: 'quiz', label: `📝 Trắc nghiệm (${state.progress.bestQuizScore}/${QUIZ_QUESTIONS.length})` },
      { id: 'prompts', label: '🛠️ Kho Prompt Công vụ' },
      { id: 'handbook', label: '🛡️ Cẩm nang & Sổ tay' },
    ];

    container.innerHTML = `
      <div class="page-wrapper" style="max-width:1280px;margin:0 auto;padding:16px 20px;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;font-size:1.42rem;color:var(--text-main);">🎓 Góc Học tập số & Cẩm nang AI Công vụ</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.9rem;">Học trực tuyến, thực hành AI tại chỗ và kiểm tra kiến thức số theo <strong>Nghị quyết 11/NQ-CP ngày 14/01/2026</strong>.</p>
          </div>
          <a class="btn btn-secondary" href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 Mở cổng NQ 57 Lâm Đồng</a>
        </div>

        <div class="panel-group" style="margin-bottom:14px;padding:12px 16px;">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;font-size:0.88rem;">
            <span><strong>Tiến độ Học tập số của bạn:</strong> ${pct}% (${state.progress.completedLessons.length}/${LESSONS.length} chuyên đề · ${state.progress.sandboxRuns} lượt thực hành AI · Điểm trắc nghiệm cao nhất: ${state.progress.bestQuizScore}/${QUIZ_QUESTIONS.length})</span>
            <span style="color:#0f766e;font-weight:700;">${pct === 100 && state.progress.bestQuizScore >= 6 ? '🏆 Đã hoàn thành xuất sắc' : 'Đang học tập'}</span>
          </div>
          <div style="width:100%;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#0f766e,#10b981);transition:width 0.3s;"></div>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          ${tabs.map((t) => `
            <button type="button" class="btn ${state.activeTab === t.id ? 'btn-primary' : 'btn-secondary'} dl-tab-btn" data-tab="${t.id}">${t.label}</button>
          `).join('')}
        </div>

        <div id="dl-tab-content">
          ${state.activeTab === 'courses' ? renderCoursesTab() : ''}
          ${state.activeTab === 'sandbox' ? renderSandboxTab() : ''}
          ${state.activeTab === 'quiz' ? renderQuizTab() : ''}
          ${state.activeTab === 'prompts' ? renderPromptsTab() : ''}
          ${state.activeTab === 'handbook' ? renderHandbookTab() : ''}
        </div>
      </div>
    `;

    // Tab navigation
    container.querySelectorAll('.dl-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        render();
      });
    });

    // Courses handlers
    container.querySelectorAll('.dl-select-lesson').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedLessonId = btn.dataset.id;
        render();
      });
    });
    container.querySelector('#dl-toggle-done')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const idx = state.progress.completedLessons.indexOf(id);
      if (idx >= 0) state.progress.completedLessons.splice(idx, 1);
      else state.progress.completedLessons.push(id);
      saveProgress(state.progress);
      render();
    });
    container.querySelector('#dl-practice-this')?.addEventListener('click', () => {
      const lesson = LESSONS.find((l) => l.id === state.selectedLessonId) || LESSONS[0];
      state.sandboxPrompt = `Hãy tóm tắt ngắn gọn và đưa ra 1 ví dụ áp dụng thực tế cho cán bộ công chức về: ${lesson.title} (lưu ý dùng đúng định dạng ngày DD/MM/YYYY).`;
      state.sandboxOutput = '';
      state.sandboxError = '';
      state.activeTab = 'sandbox';
      render();
    });
    container.querySelector('#dl-goto-quiz')?.addEventListener('click', () => {
      state.activeTab = 'quiz';
      render();
    });

    // Sandbox handlers
    const sbInput = container.querySelector('#dl-sb-input');
    sbInput?.addEventListener('input', (e) => { state.sandboxPrompt = e.target.value; });
    container.querySelector('#dl-sb-mode')?.addEventListener('change', (e) => { state.sandboxMode = e.target.value; });
    container.querySelector('#dl-sb-preset')?.addEventListener('change', (e) => {
      if (e.target.value === '') return;
      const item = PROMPT_LIBRARY[Number(e.target.value)];
      if (item) {
        state.sandboxPrompt = item.prompt;
        state.sandboxOutput = '';
        state.sandboxError = '';
        render();
      }
    });
    container.querySelector('#dl-sb-copy')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(state.sandboxPrompt || '');
      showToast('Đã sao chép câu lệnh!', 'success');
    });
    container.querySelector('#dl-sb-copy-out')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(state.sandboxOutput || '');
      showToast('Đã sao chép kết quả thực hành!', 'success');
    });
    container.querySelector('#dl-sb-clear')?.addEventListener('click', () => {
      state.sandboxPrompt = '';
      state.sandboxOutput = '';
      state.sandboxError = '';
      render();
    });
    container.querySelector('#dl-sb-run')?.addEventListener('click', async () => {
      const prompt = (container.querySelector('#dl-sb-input')?.value || '').trim();
      state.sandboxPrompt = prompt;
      if (!prompt) { showToast('Vui lòng nhập câu lệnh thực hành.', 'error'); return; }
      state.sandboxRunning = true;
      state.sandboxError = '';
      state.sandboxOutput = '';
      render();
      try {
        const modeSystemMap = {
          soan_thao: 'Bạn là giảng viên hướng dẫn thực hành AI công vụ của Văn phòng UBND tỉnh Lâm Đồng. Hãy thực hiện yêu cầu soạn thảo chuẩn thể thức NĐ30/HD05, dùng định dạng ngày DD/MM/YYYY, không viết ngày ... tháng ... năm ..., và cuối bài có 2 dòng nhận xét ngắn về cách tối ưu câu lệnh.',
          phan_tich: 'Bạn là chuyên gia đào tạo Nghị quyết 57-NQ/TW, NQ 11/NQ-CP và QĐ 1425/QĐ-TTg. Hãy phân tích súc tích, chính xác, trình bày rõ ràng theo gạch đầu dòng, dùng định dạng ngày DD/MM/YYYY.',
          cham_diem: 'Bạn là huấn luyện viên viết Prompt công vụ. Hãy chấm điểm câu lệnh của học viên theo thang 100 (dựa trên 5 yếu tố: Vai trò, Loại văn bản, Căn cứ, Yêu cầu đầu ra, Thể thức & An toàn thông tin) và viết lại 1 phiên bản Prompt tối ưu hơn.',
        };
        const resp = await sendChatRequest(
          [
            { role: 'system', content: modeSystemMap[state.sandboxMode] || modeSystemMap.soan_thao },
            { role: 'user', content: prompt },
          ],
          null,
          { temperature: 0.2, timeoutMs: 90000, provider: 'gemini' }
        );
        state.sandboxOutput = resp;
        state.progress.sandboxRuns += 1;
        saveProgress(state.progress);
      } catch (err) {
        state.sandboxError = err.message || 'Không thể chạy thực hành AI.';
      } finally {
        state.sandboxRunning = false;
        render();
      }
    });

    // Quiz handlers
    container.querySelectorAll('.dl-quiz-opt').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        state.quizAnswers[Number(e.target.dataset.q)] = Number(e.target.value);
      });
    });
    container.querySelector('#dl-quiz-submit')?.addEventListener('click', () => {
      const answered = Object.keys(state.quizAnswers).length;
      if (answered < QUIZ_QUESTIONS.length) {
        showToast(`Vui lòng trả lời đủ ${QUIZ_QUESTIONS.length} câu (hiện mới chọn ${answered} câu).`, 'error');
        return;
      }
      let score = 0;
      QUIZ_QUESTIONS.forEach((q, idx) => {
        if (Number(state.quizAnswers[idx]) === q.answer) score += 1;
      });
      state.quizSubmitted = true;
      state.progress.quizAttempts += 1;
      if (score > state.progress.bestQuizScore) state.progress.bestQuizScore = score;
      saveProgress(state.progress);
      render();
    });
    container.querySelector('#dl-quiz-retry')?.addEventListener('click', () => {
      state.quizAnswers = {};
      state.quizSubmitted = false;
      render();
    });
    container.querySelector('#dl-quiz-print')?.addEventListener('click', () => {
      window.print();
    });

    // Prompt library handlers
    container.querySelectorAll('.dl-filter-group').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.promptGroupFilter = btn.dataset.group;
        render();
      });
    });
    container.querySelectorAll('.dl-run-in-sandbox').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = PROMPT_LIBRARY[Number(btn.dataset.idx)];
        if (item) {
          state.sandboxPrompt = item.prompt;
          state.sandboxOutput = '';
          state.sandboxError = '';
          state.activeTab = 'sandbox';
          render();
        }
      });
    });
    container.querySelectorAll('.dl-copy-tpl').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = PROMPT_LIBRARY[Number(btn.dataset.idx)];
        if (item) {
          navigator.clipboard?.writeText(item.prompt);
          showToast('Đã sao chép câu lệnh mẫu!', 'success');
        }
      });
    });
  }

  render();
}
