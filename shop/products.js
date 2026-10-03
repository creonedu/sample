/*
 * ===============================================================
 *  크레온에듀 교재 목록 · 쇼핑몰 설정 파일
 *  ─ 대표님(운영자)이 직접 고치는 파일은 이 파일 하나뿐입니다. ─
 * ===============================================================
 *
 *  ✏️ 교재 추가/수정 방법
 *   - 아래 products 목록에서 { ... } 한 덩어리가 교재 1권입니다.
 *   - 한 덩어리를 복사해서 붙여넣고 내용만 바꾸면 교재가 추가됩니다.
 *   - id 는 교재마다 서로 다른 영문/숫자로 정해주세요. (한 번 정하면 바꾸지 마세요)
 *   - price 는 숫자만 씁니다. (쉼표·원 표시 없이: 18000)
 *   - soldOut: true 로 바꾸면 '품절'로 표시되고 구매가 막힙니다.
 *   - image 는 비워두면 기본 표지가 나옵니다. 사진을 쓰려면 shop/images 폴더에
 *     파일을 넣고 'images/파일이름.jpg' 처럼 적어주세요.
 *
 *  ⚠️ 쉼표(,)와 따옴표('')를 지우지 않도록 주의해주세요.
 *     결제 금액 검증도 이 파일 기준으로 서버에서 다시 계산하므로,
 *     가격은 이 파일에서만 바꾸면 됩니다.
 */
var CREON_SHOP = {
  // ── 회사 정보 (페이지 하단 표시 · PG사 심사 필수 항목) ──
  company: {
    name: '크레온에듀(주)',
    ceo: '김동욱',
    bizNumber: '147-87-03501',            // 사업자등록번호
    mailOrderNumber: '신고번호 입력',       // 통신판매업 신고번호 (확인 후 입력)
    address: '서울특별시 중구 퇴계로 15 에너지플러스 9층 (스파크플러스 919호)',
    phone: '010-9550-5506',
    email: 'creonedu@gmail.com',
    privacyOfficer: '김동욱',               // 개인정보보호책임자 (다른 분이면 수정)
    service: '퀘스트온',                     // 운영 서비스명
    website: 'https://www.queston.kr'
  },

  // ── 배송비 정책 ──
  shipping: {
    fee: 3000,            // 기본 배송비 (원)
    freeOver: 50000       // 이 금액 이상 주문 시 무료배송 (원). 항상 유료면 0
  },

  // ── 결제 설정 ──
  payment: {
    // 토스페이먼츠 '클라이언트 키' (공개되어도 괜찮은 키)
    // 지금은 토스 공식 문서용 테스트 키입니다. 실제 돈이 나가지 않습니다.
    // 계약 후 개발자센터 > API 키 > '결제위젯 연동 키'의 라이브 클라이언트 키로 바꾸세요.
    tossClientKey: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'
  },

  // ── 교재 목록 (예시 데이터 — 실제 교재로 바꿔주세요) ──
  categories: ['전체', 'ESL 정규', 'TOEFL', '문법·어휘', '방학 특강'],
  products: [
    { id: 'esl-bridge-1', name: 'Bridge Reading 1', category: 'ESL 정규', level: 'Bridge', price: 18000, desc: 'Bridge 레벨 정규반 리딩 교재 (워크북 포함)', image: '', soldOut: false },
    { id: 'esl-par-1',    name: 'Par Reading & Writing 1', category: 'ESL 정규', level: 'Par', price: 19000, desc: 'Par 레벨 리딩·라이팅 통합 교재', image: '', soldOut: false },
    { id: 'esl-birdie-1', name: 'Birdie Reading & Writing 1', category: 'ESL 정규', level: 'Birdie', price: 19000, desc: 'Birdie 레벨 리딩·라이팅 통합 교재', image: '', soldOut: false },
    { id: 'esl-eagle-1',  name: 'Eagle Academic Reading', category: 'ESL 정규', level: 'Eagle', price: 22000, desc: 'Eagle 레벨 아카데믹 리딩', image: '', soldOut: false },
    { id: 'toefl-jr-1',   name: 'TOEFL Junior 실전 모의고사', category: 'TOEFL', level: 'Birdie~Eagle', price: 24000, desc: '실전 모의고사 5회분 + 해설', image: '', soldOut: false },
    { id: 'toefl-ibt-1',  name: 'TOEFL iBT Starter', category: 'TOEFL', level: 'Alba 이상', price: 28000, desc: 'iBT 4영역 입문 교재', image: '', soldOut: false },
    { id: 'gram-1',       name: '크레온 Grammar 1', category: '문법·어휘', level: '전 레벨', price: 15000, desc: '초등 고학년 필수 문법', image: '', soldOut: false },
    { id: 'voca-1',       name: '크레온 Voca 1200', category: '문법·어휘', level: '전 레벨', price: 13000, desc: '레벨별 필수 어휘 1200', image: '', soldOut: true },
    { id: 'winter-2026',  name: '2026 겨울 특강 교재', category: '방학 특강', level: '특강 수강생', price: 25000, desc: '겨울방학 집중 특강 전용 교재', image: '', soldOut: false }
  ]
};

/* 아래는 건드리지 마세요 (서버와 페이지가 같은 목록을 함께 쓰기 위한 코드) */
if (typeof module !== 'undefined' && module.exports) { module.exports = CREON_SHOP; }
