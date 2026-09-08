const { MongoClient } = require('mongodb');

function isCodeOrCorruptedText(str) {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim();
  if (s.length < 5) return true;
  if (/dataLayer|function\s*\(|gtag\(|_govaq|@context|schema\.org|document\.getElementById|\.addEventListener|\$\(document\)|var\s+\w+|const\s+\w+|let\s+\w+|window\.|\.css\(|\.attr\(|\.split\(|\.indexOf\(|setInterval\(|setTimeout\(/i.test(s)) {
    return true;
  }
  if (s.startsWith('{') || s.startsWith('[') || /"@[a-z]+"\s*:/i.test(s) || /"name"\s*:/i.test(s)) {
    return true;
  }
  if (/\{[^}]*(?:cursor|display|padding|margin|color|background|border)\s*:[^}]*\}/i.test(s)) {
    return true;
  }
  return false;
}

async function fixCorruptedTitles() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vbai_db');
  console.log('[Fix] Connected to MongoDB');

  // 1. Fix 71/2026/TT-BGDĐT
  console.log('[Fix] Repairing 71/2026/TT-BGDĐT...');
  await db.collection('known_documents').updateMany(
    {
      $or: [
        { document_number: '71/2026/TT-BGDĐT' },
        { documentNumber: '71/2026/TT-BGDĐT' }
      ]
    },
    {
      $set: {
        document_number: '71/2026/TT-BGDĐT',
        documentNumber: '71/2026/TT-BGDĐT',
        title: 'Quy định về hội đồng trường của cơ sở giáo dục đại học, giáo dục nghề nghiệp tư thục',
        document_type: 'thong_tu',
        documentType: 'thong_tu',
        issuer: 'Bộ Giáo dục và Đào tạo',
        issue_date: '2026-09-08',
        issueDate: '2026-09-08',
        effective_date: '2026-10-23',
        effectiveDate: '2026-10-23',
        effective_status: 'in_force',
        effectiveStatus: 'in_force',
        status_as_of: '2026-09-08',
        tom_tat_chinh_sach: 'Bộ trưởng Bộ Giáo dục và Đào tạo ban hành Thông tư 71/2026/TT-BGDĐT quy định về hội đồng trường của cơ sở giáo dục đại học, cơ sở giáo dục nghề nghiệp tư thục.',
        summary: 'Bộ trưởng Bộ Giáo dục và Đào tạo ban hành Thông tư 71/2026/TT-BGDĐT quy định về hội đồng trường của cơ sở giáo dục đại học, cơ sở giáo dục nghề nghiệp tư thục.',
        noi_dung_chi_tiet: 'Thông tư 71/2026/TT-BGDĐT của Bộ Giáo dục và Đào tạo quy định về cơ cấu tổ chức, thành phần, tiêu chuẩn thành viên, nhiệm vụ, quyền hạn và phương thức hoạt động của Hội đồng trường trong các cơ sở giáo dục đại học và cơ sở giáo dục nghề nghiệp tư thục, bảo đảm tính tự chủ và trách nhiệm giải trình.',
        official_source_urls: ['https://baochinhphu.vn/quy-dinh-ve-hoi-dong-truong-cua-co-so-giao-duc-dai-hoc-giao-duc-nghe-nghiep-tu-thuc-102260907142949822.htm'],
        topic_aliases: [
          '71/2026/TT-BGDĐT',
          'thông tư 71',
          'thông tư 71/2026',
          'thông tư số 71',
          'hội đồng trường đại học tư thục',
          'hội đồng trường nghề tư thục',
          'Quy định về hội đồng trường của cơ sở giáo dục đại học, giáo dục nghề nghiệp tư thục'
        ],
        query_patterns: [
          '71/2026/tt-bgdđt',
          'thong tu 71',
          'thong tu 71/2026',
          '71/2026/tt',
          'hoi dong truong tu thuc'
        ],
        updated_at: new Date()
      }
    }
  );

  // 2. Fix 98/2023/QH15
  console.log('[Fix] Repairing 98/2023/QH15...');
  await db.collection('known_documents').updateMany(
    {
      $or: [
        { document_number: '98/2023/QH15' },
        { documentNumber: '98/2023/QH15' }
      ]
    },
    {
      $set: {
        document_number: '98/2023/QH15',
        documentNumber: '98/2023/QH15',
        title: 'Nghị quyết số 98/2023/QH15 của Quốc hội về thí điểm một số cơ chế, chính sách đặc thù phát triển Thành phố Hồ Chí Minh',
        document_type: 'nghi_quyet',
        documentType: 'nghi_quyet',
        issuer: 'Quốc hội',
        issue_date: '2023-06-24',
        issueDate: '2023-06-24',
        effective_date: '2023-08-01',
        effectiveDate: '2023-08-01',
        effective_status: 'in_force',
        effectiveStatus: 'in_force',
        status_as_of: '2026-09-08',
        tom_tat_chinh_sach: 'Nghị quyết thí điểm một số cơ chế, chính sách đặc thù phát triển Thành phố Hồ Chí Minh về quản lý đầu tư, tài chính, ngân sách nhà nước, đất đai, quy hoạch và tổ chức bộ máy.',
        summary: 'Nghị quyết thí điểm một số cơ chế, chính sách đặc thù phát triển Thành phố Hồ Chí Minh về quản lý đầu tư, tài chính, ngân sách nhà nước, đất đai, quy hoạch và tổ chức bộ máy.',
        noi_dung_chi_tiet: 'Nghị quyết số 98/2023/QH15 gồm 12 điều quy định 44 cơ chế, chính sách đặc thù trên các lĩnh vực: quản lý đầu tư công, phương thức PPP, TOD (phát triển đô thị theo định hướng giao thông công cộng), ưu đãi thuế cho đổi mới sáng tạo, cơ chế phân cấp phân quyền cho UBND TP.HCM và TP Thủ Đức.',
        official_source_urls: ['https://congbao.chinhphu.vn/'],
        topic_aliases: [
          '98/2023/QH15',
          'nghị quyết 98',
          'nghị quyết 98/2023',
          'cơ chế đặc thù tphcm',
          'Nghị quyết số 98/2023/QH15 của Quốc hội'
        ],
        query_patterns: [
          '98/2023/qh15',
          'nghi quyet 98',
          'nghi quyet 98/2023',
          'co che dac thu tphcm'
        ],
        updated_at: new Date()
      }
    }
  );

  // 3. Fix 136/2024/QH15
  console.log('[Fix] Repairing 136/2024/QH15...');
  await db.collection('known_documents').updateMany(
    {
      $or: [
        { document_number: '136/2024/QH15' },
        { documentNumber: '136/2024/QH15' }
      ]
    },
    {
      $set: {
        document_number: '136/2024/QH15',
        documentNumber: '136/2024/QH15',
        title: 'Nghị quyết số 136/2024/QH15 của Quốc hội về tổ chức chính quyền đô thị và thí điểm một số cơ chế, chính sách đặc thù phát triển thành phố Đà Nẵng',
        document_type: 'nghi_quyet',
        documentType: 'nghi_quyet',
        issuer: 'Quốc hội',
        issue_date: '2024-06-26',
        issueDate: '2024-06-26',
        effective_date: '2025-01-01',
        effectiveDate: '2025-01-01',
        effective_status: 'in_force',
        effectiveStatus: 'in_force',
        status_as_of: '2026-09-08',
        tom_tat_chinh_sach: 'Nghị quyết của Quốc hội về tổ chức mô hình chính quyền đô thị tại Đà Nẵng và thí điểm các cơ chế, chính sách đặc thù phát triển thành phố Đà Nẵng.',
        summary: 'Nghị quyết của Quốc hội về tổ chức mô hình chính quyền đô thị tại Đà Nẵng và thí điểm các cơ chế, chính sách đặc thù phát triển thành phố Đà Nẵng.',
        noi_dung_chi_tiet: 'Nghị quyết số 136/2024/QH15 quy định về tổ chức chính quyền đô thị tại Đà Nẵng và các cơ chế đặc thù vượt trội: thành lập Khu thương mại tự do Đà Nẵng gắn với Cảng biển Liên Chiểu, ưu đãi đầu tư chiến lược trong ngành vi mạch bán dẫn và trí tuệ nhân tạo (AI).',
        official_source_urls: ['https://congbao.chinhphu.vn/'],
        topic_aliases: [
          '136/2024/QH15',
          'nghị quyết 136',
          'nghị quyết 136/2024',
          'chính quyền đô thị đà nẵng',
          'khu thương mại tự do đà nẵng',
          'Nghị quyết số 136/2024/QH15 của Quốc hội'
        ],
        query_patterns: [
          '136/2024/qh15',
          'nghi quyet 136',
          'nghi quyet 136/2024',
          'chinh quyen do thi da nang'
        ],
        updated_at: new Date()
      }
    }
  );

  // 4. Scan ALL other documents in known_documents and fix any other corrupted titles
  console.log('[Fix] Scanning all documents for corrupted text or scripts...');
  const allDocs = await db.collection('known_documents').find({}).toArray();
  let cleanedCount = 0;

  for (const d of allDocs) {
    const num = d.document_number || d.documentNumber;
    let title = d.title || '';
    let summary = d.tom_tat_chinh_sach || d.summary || '';
    let detail = d.noi_dung_chi_tiet || '';
    let needsUpdate = false;

    if (isCodeOrCorruptedText(title)) {
      title = `Văn bản quy phạm pháp luật số ${num}`;
      needsUpdate = true;
    }

    if (isCodeOrCorruptedText(summary)) {
      summary = title;
      needsUpdate = true;
    }

    if (isCodeOrCorruptedText(detail)) {
      detail = summary;
      needsUpdate = true;
    }

    // Clean html residues (trailing "> or quotes)
    if (title.endsWith('">') || title.endsWith('"') || title.startsWith('"')) {
      title = title.replace(/^["']+|["'>]+$/g, '').trim();
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.collection('known_documents').updateOne(
        { _id: d._id },
        {
          $set: {
            title,
            tom_tat_chinh_sach: summary,
            summary,
            noi_dung_chi_tiet: detail,
            updated_at: new Date()
          }
        }
      );
      cleanedCount++;
      console.log(`[Fix] Cleaned document: ${num}`);
    }
  }

  console.log(`[Fix] Finished! Cleaned ${cleanedCount} documents.`);
  await client.close();
}

fixCorruptedTitles().catch(console.error);
