# Studyfy(스터디파이) 운영 가이드

크레온에듀(주)가 운영하는 고입·대입 비교과 컨설팅 사이트입니다.
주소: `https://<배포 도메인>/studyfy/`

## 구성

| 파일 | 역할 |
|---|---|
| `studyfy/programs.js` | **운영자가 고치는 유일한 파일** — 회사 정보, 서비스 소개, 프로그램·가격, 진행 절차, FAQ, 토스 키 |
| `studyfy/index.html` · `app.js` · `style.css` · `common.js` | 소개 · 프로그램 · 상담 신청 · 수강신청/결제 화면 |
| `studyfy/success.html` · `fail.html` | 결제 결과 화면 |
| `api/studyfy-confirm.js` | 결제 승인 (서버에서 가격 재확인 → 토스 승인 → 시트 기록) |
| `api/studyfy-consult.js` | 무료 상담 신청 접수 → 시트 기록 |
| `docs/studyfy-sheet-script.gs` | 구글 시트에 붙여넣는 기록 스크립트 |

## 사용자 흐름

```
소개 → 프로그램(대상별 필터) → [수강신청] → 신청자·학생 정보 → 토스 결제 → 완료(영수증)
소개 → 무료 상담 신청 폼 → 접수 완료 (시트 '상담신청' 탭에 기록)
```

## 1단계 — 프로그램·가격 수정
`studyfy/programs.js` 의 `programs` 목록을 고칩니다. 가격(`price`)은 숫자만, 마감은 `closed: true`, 추천 표시는 `best: true`.
결제 금액은 서버가 이 파일 기준으로 다시 확인하므로 다른 곳을 고칠 필요가 없습니다.

## 2단계 — 결제 키
교재몰과 같은 토스페이먼츠 상점을 쓰면 Vercel 환경변수 `TOSS_SECRET_KEY` 를 그대로 공유합니다.
`programs.js` 의 `tossClientKey` 를 라이브 클라이언트 키로 바꾸면 실결제가 시작됩니다. (지금은 테스트 키 — 돈이 나가지 않음)
> 상점을 분리하려면 별도 Vercel 프로젝트로 배포하거나 문의해주세요.

## 3단계 — 구글 시트 연결 (상담·수강신청 자동 기록)
1. 새 구글 시트 → 확장 프로그램 → Apps Script → `docs/studyfy-sheet-script.gs` 내용 붙여넣기
2. `SECRET` 값을 임의의 긴 문자열로 바꾸기
3. 배포 → 새 배포 → 유형 '웹 앱' → 액세스 '모든 사용자' → 웹 앱 URL 복사
4. Vercel 환경변수 추가: `STUDYFY_WEBHOOK_URL`(웹 앱 URL), `STUDYFY_WEBHOOK_SECRET`(2번 값) → 재배포

시트를 연결하기 전에도 모든 신청은 Vercel 로그(`[STUDYFY_CONSULT]`, `[STUDYFY_ENROLL]`)에 남습니다.

## 오픈 전 체크리스트
- [ ] 프로그램·가격을 실제 상품으로 교체 (현재 예시 데이터)
- [ ] 이용약관·개인정보처리방침·환불 정책 문구 법률 검토 후 교체 (`studyfy/common.js` 의 `POLICIES`)
- [ ] 토스페이먼츠 심사 시 Studyfy 주소와 판매 상품(컨설팅 서비스) 등록
- [ ] 테스트 결제 1건 → 시트 기록 확인 → 토스 상점관리자에서 취소
