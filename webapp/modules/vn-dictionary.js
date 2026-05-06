/**
 * Vietnamese Spelling Dictionary  Common errors in administrative documents
 * Format: { wrong: correct }
 */

// Common spelling mistakes in Vietnamese administrative documents
export const SPELLING_ERRORS = {
  // Sai ph? m d?u
  's? l': 'x? l', 's? ph?t': 'x? ph?t',
  'xu l': 'x? l', 'x? l': 'x? l',
  'gim d?t': 'gim d?c', 'gim d?k': 'gim d?c',
  'ngh? quy?t': 'ngh? quy?t', 'ngh? quy?ch': 'ngh? quy?t',
  'dnh gi': 'dnh gi', 'dn gi': 'dnh gi',
  'ch?p hng': 'ch?p hnh',
  'k?t l?n': 'k?t lu?n', 'k?ch lu?n': 'k?t lu?n',
  'ch? d?': 'ch? d?o', 'ch? d?o': 'ch? d?o',
  'tri?n kha': 'tri?n khai', 'chi?n khai': 'tri?n khai',
  'th?c hi?ng': 'th?c hi?n', 'th?c hi?m': 'th?c hi?n',
  'quy?t d?ng': 'quy?t d?nh', 'quy?ch d?nh': 'quy?t d?nh',
  'hu?ng d?n': 'hu?ng d?n', 'hu?g d?n': 'hu?ng d?n',
  'gi?i quy?ch': 'gi?i quy?t', 'gi?i quy?d': 'gi?i quy?t',
  't? ch?t': 't? ch?c',
  'pht chi?n': 'pht tri?n', 'phch tri?n': 'pht tri?n',
  'qu?n l': 'qu?n l', 'qu?ng l': 'qu?n l',
  'ki?m cha': 'ki?m tra',
  'nghing c?u': 'nghin c?u', 'nghin cuu': 'nghin c?u',
  'bo cu': 'bo co', 'b?o co': 'bo co',
  'th?ng k?': 'th?ng k', 'th?n k': 'th?ng k',
  'do t?u': 'do t?o', 'du t?o': 'do t?o',
  'b?o dm': 'b?o d?m', 'bo d?m': 'b?o d?m',
  'chuong chnh': 'chuong trnh', 'truong trnh': 'chuong trnh',
  'bing b?n': 'bin b?n', 'bin bn': 'bin b?n',
  'trch nhi?n': 'trch nhi?m', 'chch nhi?m': 'trch nhi?m',
  'chng sch': 'chnh sch',
  'nguyn nhng': 'nguyn nhn', 'nguyn nhm': 'nguyn nhn',
  'phuong hu?n': 'phuong hu?ng', 'phuong hu?g': 'phuong hu?ng',
  'nhi?n v?': 'nhi?m v?', 'nhi?m v?': 'nhi?m v?',
  'gi?i pht': 'gi?i php', 'gii php': 'gi?i php',
  'd? su?t': 'd? xu?t', 'd? xu?c': 'd? xu?t',
  'n?i dun': 'n?i dung', 'n? dung': 'n?i dung',
  'cng tt': 'cng tc', 'cn tc': 'cng tc',
  'yu c?': 'yu c?u', 'yu c?n': 'yu c?u',
  'tiu chu?n': 'tiu chu?n', 'tiu chu?ng': 'tiu chu?n',
  'ph duy?ch': 'ph duy?t', 'ph duy?d': 'ph duy?t',
  'chu?ng b?': 'chu?n b?', 'chu?n b': 'chu?n b?',
  'dan k': 'dang k',
  'gio d?t': 'gio d?c', 'giu d?c': 'gio d?c',
  'sng ki?ng': 'sng ki?n', 'sn ki?n': 'sng ki?n',

  // Sai d?u thanh di?u
  'chnh phu': 'chnh ph?', 'chnh ph': 'chnh ph?',
  'thu t?c': 'th? t?c',
  'l?nh d?o': 'lnh d?o',
  'co quang': 'co quan', 'co qun': 'co quan',
  'ngn sck': 'ngn sch', 'ngng sch': 'ngn sch',
  'd?u t?': 'd?u tu',
  'd? ng': 'd? n', 'd? n': 'd? n',
  'cng b?': 'cn b?',
  'th?m tra': 'th?m tra',
  'k? lu?c': 'k? lu?t', 'k? lu?t': 'k? lu?t',
  'k? thu?c': 'k? thu?t', 'k? thu?t': 'k? thu?t',
  'ti chn': 'ti chnh', 'ti chnh': 'ti chnh',
  'phuong ng': 'phuong n', 'phuong n': 'phuong n',
  'hon thi?ng': 'hon thi?n', 'hong thi?n': 'hon thi?n',
  'quy h?ach': 'quy ho?ch',
  'nhn su': 'nhn s?', 'nhng s?': 'nhn s?',
  'thnh lp': 'thnh l?p', 'thng l?p': 'thnh l?p',
  'ban hng': 'ban hnh', 'bn hnh': 'ban hnh',
  'thi hng': 'thi hnh', 'th hnh': 'thi hnh',
  'ph?n vi': 'ph?m vi', 'ph?m v': 'ph?m vi',
  'di?u ch?n': 'di?u ch?nh', 'di?u ch?ng': 'di?u ch?nh',
  'b? nhi?n': 'b? nhi?m',
  'mi?ng nhi?m': 'mi?n nhi?m', 'mi?m nhi?m': 'mi?n nhi?m',
  'lun chuy?n': 'lun chuy?n', 'lung chuy?n': 'lun chuy?n',
  'nng c?b': 'nng c?p', 'nng cp': 'nng c?p',
  'knh ph': 'kinh ph',
  'thng t?': 'thng tu',
  'nghi d?nh': 'ngh? d?nh', 'ngh d?nh': 'ngh? d?nh',

  // Sai chnh t? ph? bi?n
  'so xu?t': 'so su?t',
  'sng su?c': 'sng su?t', 'sng xu?t': 'sng su?t',
  'v?ng d?': 'v?n d?', 'v?n d?': 'v?n d?',
  'dnh k?': 'dng k?',
  'trung thuc': 'trung th?c', 'chung th?c': 'trung th?c',
  'nghim tt': 'nghim tc', 'nghim tk': 'nghim tc',
  'tch c?t': 'tch c?c', 'tt c?c': 'tch c?c',
  'hi?u qu': 'hi?u qu?', 'hi?u qu': 'hi?u qu?',
  'ling h?': 'lin h?', 'lin h': 'lin h?',
  'h?p dng': 'h?p d?ng', 'h?p d?n': 'h?p d?ng',
  'ph?i h?b': 'ph?i h?p', 'phi h?p': 'ph?i h?p',
  'k? h?ach': 'k? ho?ch',
  'kh?ng truong': 'kh?n truong', 'kh?n truong': 'kh?n truong',
  'quy?n hnh': 'quy?n h?n',

  // L?i d/gi/r
  'danh gi?i': 'ranh gi?i', 'ranh d?i': 'ranh gi?i',
  'd?p trung': 't?p trung',
  'd?i quy?t': 'gi?i quy?t', 'r?i quy?t': 'gi?i quy?t',
  'd?n b': 'g?n b',
  'giao ving': 'gio vin',
  'rn b?': 'cn b?',

  // L?i ch/tr
  'chong d?i': 'trng d?i',
  'chch nhi?m': 'trch nhi?m',
  'chi?n khai': 'tri?n khai',
  'chnh by': 'trnh by', 'trng by': 'trnh by',
  'ch?c ti?p': 'tr?c ti?p', 'truc ti?p': 'tr?c ti?p',
  'chi?u hnh': 'di?u hnh',
  'chu?ng h?p': 'tru?ng h?p', 'truong h?p': 'tru?ng h?p',
  'ch? s?': 'tr? s?', 'tr? s?': 'tr? s?',

  // L?i s/x
  'sy d?ng': 'xy d?ng', 'xy dung': 'xy d?ng',
  'sc nh?n': 'xc nh?n', 'xt nh?n': 'xc nh?n',
  'sem xt': 'xem xt', 'xem xc': 'xem xt',
  's?p x?b': 's?p x?p', 's?p s?p': 's?p x?p',
  'sc d?nh': 'xc d?nh', 'xc dnh': 'xc d?nh',
  'sung d?t': 'xung d?t', 'xun d?t': 'xung d?t',

  // L?i n/ng cu?i
  'bng giao': 'bn giao',
  'hon thn': 'hon thnh', 'hon thng': 'hon thnh',
  'sinh ho?ch': 'sinh ho?t',
  'gio d?ng': 'gio d?c',
  'ti?p nh?m': 'ti?p nh?n',
  'phn cn': 'phn cng', 'phn cg': 'phn cng',
  'ki?n ngh?': 'ki?n ngh?', 'ki?n ngh': 'ki?n ngh?',

  // L?i vi?t t?t sai
  'UB.ND': 'UBND',
  'H.ND': 'HND',
  'BTC.CB': 'BTCCB',

  // L?i d?c th t? van b?n th?c t? (user-reported)
  'tnh hn': 'tnh hnh',
  'tn hnh': 'tnh hnh',
  'tnh hng': 'tnh hnh',
  'ch? s': 'ch? s?',
  'ch? s': 'ch? s?',
  'chi s?': 'ch? s?',

  // L?i hng/h?ng (r?t ph? bi?n)
  'hng tu?n': 'h?ng tu?n',
  'hng thng': 'h?ng thng',
  'hng nam': 'h?ng nam',
  'hng ngy': 'h?ng ngy',
  'hng qu': 'h?ng qu',

  // L?i thi?u ch? ph? bi?n
  'c?i cc': 'c?i cch',
  'hnh chn': 'hnh chnh',
  'hnh chinh': 'hnh chnh',
  'cng ch?': 'cng ch?c',
  'vin ch?': 'vin ch?c',
  'ch?c nan': 'ch?c nang',
  'quy dnh': 'quy d?nh',
  'quy d?n': 'quy d?nh',
  'th?c hi?': 'th?c hi?n',
  'phuong ph': 'phuong php',
  'dp un': 'dp ?ng',
  'dp ?n': 'dp ?ng',
  'ch? ti': 'ch? tiu',
  'k?t qu': 'k?t qu?',
};

/**
 * Quy t?c vi?t hoa T? CH?C (c?m di, an ton match  lun p d?ng)
 * Format: { sai (lowercase): dng (d vi?t hoa chu?n) }
 */
export const CAPITALIZATION_RULES = {
  // ===== T? ch?c ?ng/Nh nu?c =====
  'ban ch?p hnh': 'Ban Ch?p hnh',
  'ban thu?ng v?': 'Ban Thu?ng v?',
  'ban thu?ng tr?c': 'Ban Thu?ng tr?c',
  'ban t? ch?c': 'Ban T? ch?c',
  'ban ki?m tra': 'Ban Ki?m tra',
  'ban ki?m sot': 'Ban Ki?m sot',
  'ban dn v?n': 'Ban Dn v?n',
  'ban tuyn gio': 'Ban Tuyn gio',
  'ban n?i chnh': 'Ban N?i chnh',
  'ban kinh t?': 'Ban Kinh t?',
  'ban ch? d?o': 'Ban Ch? d?o',
  'ban qu?n l': 'Ban Qu?n l',
  'ban v?n d?ng': 'Ban V?n d?ng',
  'ban c? v?n': 'Ban C? v?n',
  'ban v s? ti?n b? c?a ph? n?': 'Ban V s? ti?n b? c?a ph? n?',

  // ===== Co quan hnh chnh (c?m di  an ton) =====
  '?y ban nhn dn': '?y ban nhn dn',
  'h?i d?ng nhn dn': 'H?i d?ng nhn dn',
  'ta n nhn dn': 'Ta n nhn dn',
  'vi?n ki?m st nhn dn': 'Vi?n ki?m st nhn dn',
  '?y ban m?t tr?n': '?y ban M?t tr?n',
  'm?t tr?n t? qu?c': 'M?t tr?n T? qu?c',
  'don ch? t?ch': 'on Ch? t?ch',
  'h?i d?ng qu?n l': 'H?i d?ng qu?n l',
  'd?i h?i d?i bi?u': '?i h?i d?i bi?u',

  // ===== T? ch?c/Khi ni?m quan tr?ng (c?m di  an ton) =====
  'th? tu?ng chnh ph?': 'Th? tu?ng Chnh ph?',
  'chnh ph?': 'Chnh ph?',
  'qu?c h?i': 'Qu?c h?i',

  // ===== Ch?c danh DI (di km ch?c v? ph?  an ton match) =====
  't?ng gim d?c': 'T?ng Gim d?c',
  'ph gim d?c': 'Ph Gim d?c',
  'ph ch? t?ch': 'Ph Ch? t?ch',
  'ph tru?ng ban': 'Ph Tru?ng ban',
  'chnh van phng': 'Chnh Van phng',
  'ph chnh van phng': 'Ph Chnh Van phng',
  'chnh thanh tra': 'Chnh Thanh tra',
  'ph chnh thanh tra': 'Ph Chnh Thanh tra',
  't?ng thu k': 'T?ng Thu k',
  'ph b thu': 'Ph B thu',
  'ph v? tru?ng': 'Ph V? tru?ng',
  'ph c?c tru?ng': 'Ph C?c tru?ng',
  'ph tru?ng phng': 'Ph Tru?ng phng',
  'chi c?c tru?ng': 'Chi c?c tru?ng',
  'chi h?i tru?ng': 'Chi h?i tru?ng',
};

/**
 * Ch?c danh NG?N  CH? vi?t hoa khi d?ng ?U CU ho?c I KM TN RING
 * Logic ki?m tra ng? c?nh du?c th?c hi?n trong spell-check.js
 * Format: { lowercase: capitalized }
 */
export const TITLE_CONTEXT_RULES = {
  'nh nu?c': 'Nh nu?c',
  'ch? t?ch': 'Ch? t?ch',
  'gim d?c': 'Gim d?c',
  'tru?ng ban': 'Tru?ng ban',
  'b thu': 'B thu',
  '?y vin': '?y vin',
  'v? tru?ng': 'V? tru?ng',
  'c?c tru?ng': 'C?c tru?ng',
  'tru?ng phng': 'Tru?ng phng',
  'h?i tru?ng': 'H?i tru?ng',
  'th? tru?ng': 'Th? tru?ng',
  'thu k': 'Thu k',
  'ph thu k': 'Ph Thu k',
};

/**
 * Danh sch ch?c danh/t? ch?c d?y d? dng cho AI system instruction
 */
export const OFFICIAL_TITLES = [
  // Ch?c danh
  'Ch? t?ch', 'Ph Ch? t?ch', 'Tru?ng ban', 'Ph Tru?ng ban',
  'Gim d?c', 'Ph Gim d?c', 'T?ng Gim d?c',
  'Chnh Van phng', 'Ph Chnh Van phng',
  'Chnh Thanh tra', 'Ph Chnh Thanh tra',
  'Thu k', 'T?ng Thu k', 'Ph Thu k',
  'B thu', 'Ph B thu',
  '?y vin', 'V? tru?ng', 'Ph V? tru?ng',
  'C?c tru?ng', 'Ph C?c tru?ng',
  'Tru?ng phng', 'Ph Tru?ng phng',
  'Chi c?c tru?ng', 'H?i tru?ng', 'Chi h?i tru?ng',
  'Th? tru?ng',
  // T? ch?c
  'Ban Ch?p hnh', 'Ban Thu?ng v?', 'Ban Thu?ng tr?c',
  'Ban T? ch?c', 'Ban Ki?m tra', 'Ban Ki?m sot',
  'Ban Dn v?n', 'Ban Tuyn gio', 'Ban N?i chnh',
  'Ban Ch? d?o', 'Ban Qu?n l', 'Ban V?n d?ng',
  '?y ban nhn dn', 'H?i d?ng nhn dn',
  'Ta n nhn dn', 'Vi?n ki?m st nhn dn',
  '?y ban M?t tr?n', 'M?t tr?n T? qu?c',
  'on Ch? t?ch', 'H?i d?ng qu?n l',
  '?i h?i d?i bi?u', 'Nhn dn (ring l?)',
  'Chnh ph?', 'Qu?c h?i', 'Nh nu?c',
  'Th? tu?ng Chnh ph?',
];

// Words that are correct but often flagged - whitelist
export const WHITELIST = [
  'UBND', 'HND', '?NG', 'N30', 'HD36',
  'C?NG HA X H?I CH? NGHIA VI?T NAM',
  '?NG C?NG S?N VI?T NAM',
  '?c l?p', 'T? do', 'H?nh phc',
  'H?i vin', '?y vin', 'Hi?p h?i',
  // Vi?t t?t don v? t?nh Lm ?ng (trch xu?t t? 235 file m?u)
  'SNV', 'STP', 'CAT', 'CCHC', 'KTTH', 'KGVX',
  'TTHC', 'DVCTT', 'PAR INDEX', 'SIPAS', 'PAPI',
  'VPUB', 'BNV', 'TCVN', 'VPUBND', 'VPCP',
  // Vi?t t?t co quan
  'BCH', 'BTV', 'BTC', 'BTT', 'BC', 'BKT', 'BKS',
  'MTTQ', 'MTTQVN', 'MTTW',
  'STC', 'SKHCN', 'SVHTTDL', 'SXD', 'SNNMT', 'STNMT',
  'PCT', 'CVP', 'PCVP', 'BGDT', 'CATP', 'CNTT', 'SYT',
  // Vi?t t?t lo?i van b?n
  'Q', 'NQ', 'TTr', 'CV', 'BC', 'KH', 'TB', 'CT', 'HD',
  'QPPL', 'VBQPPL',
  // Vi?t t?t chuyn ngnh
  'BHXH', 'BHYT', 'BHTN', 'NSNN', 'TMDV',
  'TNHH', 'MTV', 'TMCP', 'CP',
  'CSDL', 'CSDLQG', 'VNEID', 'LGSP', 'QR', 'PKI',
  'CCCD', 'ATTT', 'ANTT', 'ATVSL',
  'PCTT', 'TDTT', 'HTDN', 'DVCQG', 'VPHC', 'TKT',
  // H?i/Lin don
  'HHDN', 'HHNM', 'HHVTBT', 'HNDN', 'LBB', 'LVTCT',
  'LTKDL', 'LYL', 'LCL', 'LQV', 'CLB', 'TPL',
  // Tn ring / Khc
  'PICKLEBALL', 'TAEKWONDO', 'YOGA', 'GOLF', 'KARATE',
  'BILLIARDS', 'SNOOKER', 'VOVINAM', 'GPT', 'HIV', 'KCN', 'MTQG', 'PCMT', 'CQ', 'CST', 'XX',
];
