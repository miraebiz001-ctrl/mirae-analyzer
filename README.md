# 미래비즈온 AI분석툴 - 전체 시스템 가이드

## 🏗️ 시스템 구조

```
사용자 PC                    Cloudflare                    GitHub
┌──────────┐    인증    ┌─────────────────┐    빌드    ┌──────────┐
│ EXE 실행  │ ───────→ │ /api/license     │          │ Actions  │
│          │    ↓      │ (KV: 라이선스DB)  │          │ (자동빌드)│
│ 라이선스  │  OK      │                  │          │    ↓     │
│ 인증 화면 │ ←─────── │ /api/analyze     │          │ Releases │
│    ↓      │          │ (AI 분석 엔진)    │          │ (EXE배포) │
│ 메인 앱   │ ◄──────→ │                  │          │    ↓     │
│          │  분석요청  │ /api/naver-search│          │ 자동패치  │
│ 자동패치  │ ◄─────── │                  │ ◄─────── │          │
│ (업데이트) │  새버전   │                  │   코드    │          │
└──────────┘          └─────────────────┘          └──────────┘
```

## 🚀 배포 순서

### Step 1: GitHub 저장소 생성
1. github.com → New Repository → `mirae-analyzer` (Public)
2. 이 폴더 전체 업로드 (드래그 & 드롭)

### Step 2: GitHub Token 설정 (자동 업데이트용)
1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token
2. 권한: `repo` 체크 → Generate
3. 저장소 Settings → Secrets → `GH_TOKEN` 으로 추가

### Step 3: package.json 수정
`"owner": "YOUR_GITHUB_USERNAME"` → 실제 GitHub 유저명으로 변경

### Step 4: Cloudflare에 라이선스 시스템 배포
1. `wrangler.toml.new` → `wrangler.toml`로 이름 변경
2. `license-api-code.js` 내용을 `worker.js`에 통합
3. `wrangler deploy`

### Step 5: 첫 EXE 빌드
```bash
git tag v1.0.0
git push origin v1.0.0
```
→ GitHub Actions 자동 실행 → 3~5분 후 Releases에 EXE 생성

### Step 6: 라이선스 발급 (테스터용)
```bash
./create-license.sh BETA-A1B2-C3D4 30 "홍길동 테스터"
```

### Step 7: 테스터에게 전달
- EXE 다운로드 링크 (GitHub Releases)
- 라이선스 키

---

## 🔧 유지보수 (개발자 없이)

### 서버 문제 (분석 오류, UI 변경 등)
```
Claude에게 증상 설명 → Claude가 worker.js 수정 → Cloudflare 배포 → 완료
(EXE 재배포 불필요)
```

### EXE 문제 (실행 불가, Electron 패치 등)
```
Claude에게 증상 설명 → Claude가 코드 제공 → GitHub에 업로드
→ git tag v1.0.1 && git push origin v1.0.1
→ Actions 자동 빌드 → 사용자 앱 자동 업데이트
```

### 라이선스 관리
```bash
# 새 키 발급
./create-license.sh BETA-XXXX-XXXX 30 "메모"

# 키 상태 확인 (curl)
curl -X POST .../api/license -d '{"action":"verify","key":"BETA-XXXX-XXXX","machineId":"test"}'
```

---

## 📋 파일 설명

| 파일 | 역할 |
|------|------|
| `main.js` | Electron 메인 (라이선스 체크 + 자동 업데이트) |
| `preload.js` | 보안 브릿지 (렌더러 ↔ 메인 통신) |
| `license.html` | 라이선스 입력 화면 |
| `splash.html` | 로딩 스플래시 |
| `package.json` | 의존성 + 빌드 + 업데이트 설정 |
| `license-api-code.js` | 서버 라이선스 API (worker.js에 통합) |
| `wrangler.toml.new` | KV 바인딩 추가된 설정 |
| `create-license.sh` | 관리자 라이선스 발급 스크립트 |
| `.github/workflows/` | GitHub Actions 자동 빌드 + Release |
| `assets/icon.*` | 앱 아이콘 |
