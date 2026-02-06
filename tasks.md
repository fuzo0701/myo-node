# Myo-node (묘로드) Tasks

> **목표**: Claude Code를 쉽게 관리하는 크로스플랫폼 데스크톱 앱
> **프레임워크**: Electron + React + TypeScript + xterm.js
> **특징**: 터미널 추상화, 스킬/MCP 관리, Git 연동, Claude 렌더링
> **현재 버전**: v0.5.3 (2026-02-06)

---

## 완료된 기능 ✅

### 기본 구조
- [x] Electron + React + TypeScript 프로젝트 설정
- [x] Vite 빌드 설정
- [x] 크로스 플랫폼 패키징 설정 (Windows, macOS, Linux)

### 1. 터미널 추상화

#### 1.1 명령 실행
- [x] node-pty PTY 통신 (백엔드 명령 실행)
- [x] xterm.js 기반 터미널 렌더링
- [x] UTF-8 인코딩 자동 설정 (CMD: chcp 65001, PowerShell: OutputEncoding)
- [x] 탭 지원 (추가/삭제/전환)
- [x] 분할 화면 (가로/세로) + 크기 조절 (드래그)
- [x] 커스텀 타이틀바 (윈도우 컨트롤)
- [x] 세션 복원 (앱 재시작 시 탭/작업 디렉토리 유지)
- [x] 드래그로 탭 순서 변경
- [x] 명령어 팔레트 (Ctrl+Shift+P)
- [x] 셸 선택 기능 (OS별 기본 셸 + Windows: cmd/PowerShell 선택)

#### 1.2 결과 렌더링
- [x] 마크다운 렌더링 (react-markdown)
- [x] 코드 블록 문법 하이라이팅 (react-syntax-highlighter)
- [x] ANSI 이스케이프 코드 제거/변환
- [x] 에러 메시지 시각적 구분 (Error/Success 스타일링)
- [x] 3가지 렌더 모드 (Terminal, Hybrid, Rendered)
- [x] Thinking 블록 (접기/펼치기)
- [x] Tool Use 표시 (아이콘 + 파일 경로)
- [x] Diff 뷰 (추가/삭제 하이라이팅)
- [x] 코드 복사 버튼
- [x] 스트리밍 렌더링 최적화 (throttling, React.memo, pre-compiled regex)
- [x] Claude 작업 상태 탭 인디케이터

#### 1.2.1 Abstracted 모드 개선
- [x] Claude Code TUI 표시 개선 (claude 실행 시 xterm 풀사이즈 표시, 종료 시 블록UI 복귀)
- [x] 한글 입력 안전 유지 (xterm은 표시용, TerminalInput은 입력용)

#### 1.3 입력 처리
- [x] 명령어 팔레트 (Ctrl+Shift+P)
- [x] 히스토리 탐색 (터미널 내장 ↑↓)

### 8. 히스토리 (기본)
- [x] Claude Code 출력 자동 감지
- [x] 대화 저장 (user/assistant 메시지)
- [x] 히스토리 패널 (사이드바)
- [x] 대화 검색 기능
- [x] 대화 미리보기/펼치기
- [x] 대화 상세 보기 (마크다운 렌더링)
- [x] 히스토리 영구 저장 (localStorage)
- [x] 대화 내보내기 (Markdown, JSON)
- [x] 대화 즐겨찾기/태그

### 9. 탐색기 (기본)
- [x] 좌측 파일 트리 패널
- [x] 폴더 접기/펼치기
- [x] 파일 타입별 아이콘 색상
- [x] 현재 디렉토리 표시
- [x] 터미널과 탐색기 디렉토리 연동
- [x] 탭별 탐색기 경로 독립 관리
- [x] 파일 에디터 (읽기/쓰기, 라인 넘버, 수정 표시, Ctrl+S 저장)
- [x] 복사/잘라내기/붙여넣기 (Ctrl+C/X/V)
- [x] 컨텍스트 메뉴 (우클릭)
- [x] 새 파일/폴더 생성 — 다이얼로그 방식 (이름 입력 → 확인 후 생성, 중복 검사)
- [x] 이름 바꾸기 (F2), 삭제 (Delete)
- [x] Windows 탐색기와 클립보드 연동
- [x] 폴더 열기 시 탐색기 + 터미널 동시 갱신
- [x] 폴더 컨텍스트 메뉴 "새 탭으로 열기"

### 7.4 앱 설정 (기본)
- [x] 7개 내장 테마 (Neon, Dark, Light, Monokai, Dracula, Nord, Cyberpunk)
- [x] 커스텀 테마 생성
- [x] 폰트 크기 조절
- [x] 테마 설정 영구 저장 (localStorage)
- [x] ANSI 16색 팔레트 지원
- [x] 설정 패널

### 11. 키보드 단축키 (기본)
- [x] Ctrl+T: 새 탭
- [x] Ctrl+W: 현재 탭 닫기
- [x] Ctrl+Tab / Ctrl+Shift+Tab: 탭 전환
- [x] Ctrl+1~9: 특정 탭으로 이동
- [x] Ctrl+B: 파일 탐색기 토글
- [x] Ctrl+H: 히스토리 패널 토글
- [x] Ctrl+,: 설정 패널 토글
- [x] Ctrl+\: 가로 분할 토글
- [x] Ctrl+Shift+\: 세로 분할 토글
- [x] Ctrl+Shift+P: 명령어 팔레트
- [x] Ctrl+Shift+L: Claude 설정 패널 토글
- [x] Ctrl+Shift+C: Claude 빠른 실행
- [x] Ctrl+F: 텍스트 검색 (터미널/출력 영역/파일 에디터)
- [x] Escape: 패널 닫기

### Phase 1 MVP — Claude 관리 기능 ✅
- [x] IPC 인프라 (main.ts + preload.ts: Skills/MCP/CLAUDE.md 핸들러)
- [x] Claude 정보 표시 (ClaudeInfoBar: 모델/토큰/컨텍스트/비용)
- [x] 스킬 관리 (ClaudeSettingsPanel Skills 탭: 목록/생성/편집/삭제)
- [x] MCP 관리 (ClaudeSettingsPanel MCP 탭: Global/Project, CRUD)
- [x] 설정 확장 (모델 프리셋 + CLAUDE.md 에디터)
- [x] 통합 좌측 패널 (탐색기 옆 ResizablePanel, 아이콘 1개)

### OAuth Usage API 통합 ✅
- [x] `claude:getUsage` IPC 핸들러 (main.ts → `~/.claude/.credentials.json` → OAuth API)
- [x] `window.claude.getUsage()` preload 노출
- [x] StatusBar에 5-Hour / 7-Day / Sonnet 사용률 바 표시
- [x] tooltip에 리셋 시간 표시 (e.g. "Resets in 3h 42m")
- [x] 60초 자동 새로고침 + 수동 새로고침 버튼

### UI / 파싱 개선
- [x] SVG 아이콘 적용 (탭, 액션 버튼)
- [x] 아이콘 호버 글로우 효과
- [x] 분할 리사이저 네온 스타일
- [x] Claude Code 박스 드로잉 문자 지원
- [x] Tool use 패턴 인식 개선

---

## 진행 예정 기능 📋

### 2. Claude Code 정보 표시 🆕

#### 2.1 모델 정보
- [x] 현재 모델 표시 (Opus/Sonnet/Haiku) — ClaudeInfoBar
- [ ] 모델 버전 표시
- [ ] 모델 변경 드롭다운

#### 2.2 토큰 사용량
- [x] Input 토큰 수 — ClaudeInfoBar
- [x] Output 토큰 수 — ClaudeInfoBar
- [ ] Total 토큰 수
- [x] 실시간 업데이트 — PTY 출력 파싱 (claudeInfoParser)

#### 2.3 컨텍스트
- [x] 현재 컨텍스트 크기 — ClaudeInfoBar
- [x] 최대 컨텍스트 크기 — ClaudeInfoBar
- [x] 사용률 프로그레스 바 (예: 12k/200k) — gradient 프로그레스바

#### 2.4 캐시 정보
- [ ] 캐시 히트 토큰 수
- [ ] 캐시 히트율 (%)
- [ ] 절약 비용 표시

#### 2.5 비용
- [ ] Input 비용
- [ ] Output 비용
- [x] 세션 총 비용 — ClaudeInfoBar ($표시)
- [ ] 일별/월별 누적 비용

#### 2.6 성능
- [ ] 마지막 응답 시간
- [ ] 평균 응답 시간
- [ ] TPS (tokens per second)

---

### 3. 스킬 관리 🆕

#### 3.1 스킬 목록
- [x] `~/.claude/skills/` 디렉토리 스캔 — IPC: claude:listSkills
- [x] 스킬 이름 표시 — ClaudeSettingsPanel Skills 탭
- [x] 스킬 설명 표시 (SKILL.md 파싱) — 첫 줄 표시
- [ ] 활성화 상태 표시

#### 3.2 스킬 CRUD
- [x] 스킬 추가 (폴더 + SKILL.md 생성) — ClaudeSettingsPanel create 모드
- [x] 스킬 편집 (마크다운 에디터) — ClaudeSettingsPanel edit 모드
- [x] 스킬 삭제 (폴더 삭제) — IPC: claude:deleteSkill
- [ ] 스킬 복제

#### 3.3 스킬 상태
- [ ] 활성화/비활성화 토글
- [ ] 스킬 우선순위 설정
- [ ] 스킬 그룹화

#### 3.4 스킬 템플릿
- [ ] 기본 템플릿 제공
- [ ] 카테고리별 템플릿 (문서, API, 테스트 등)
- [ ] 커스텀 템플릿 저장

#### 3.5 스킬 미리보기
- [ ] SKILL.md 렌더링 미리보기
- [ ] 트리거 키워드 하이라이트

---

### 4. MCP 서버 관리 🆕

#### 4.1 MCP 목록
- [x] 설치된 MCP 서버 목록 조회 — IPC: claude:readMcpConfig (Global/Project)
- [x] MCP 이름, 설명 표시 — ClaudeSettingsPanel MCP 탭
- [ ] 실행 상태 표시 (실행중 / 중지)

#### 4.2 MCP CRUD
- [x] MCP 추가 (command, args 설정) — ClaudeSettingsPanel create 모드
- [x] MCP 편집 — ClaudeSettingsPanel edit 모드 (command, args, env)
- [x] MCP 삭제 — IPC: claude:writeMcpConfig
- [x] 설정 파일 자동 업데이트 — Global: ~/.claude/settings.json, Project: .mcp.json

#### 4.3 MCP 제어
- [ ] MCP 시작
- [ ] MCP 중지
- [ ] MCP 재시작
- [ ] 자동 시작 설정

#### 4.4 MCP 모니터링
- [ ] 실시간 로그 보기
- [ ] 에러 로그 필터링
- [ ] 연결 상태 확인

---

### 5. Git 패키지 설치 🆕

#### 5.1 URL 설치
- [ ] GitHub URL 입력 필드
- [ ] GitLab URL 지원
- [ ] 커스텀 Git URL 지원
- [ ] git clone 실행 (--depth 1)

#### 5.2 자동 감지
- [ ] SKILL.md 존재 여부 확인 → Skill
- [ ] mcp.json 존재 여부 확인 → MCP
- [ ] server.py 존재 여부 확인 → Python MCP
- [ ] index.ts/js 존재 여부 확인 → Node MCP
- [ ] 복합 저장소 처리 (여러 스킬/MCP 포함)

#### 5.3 의존성 설치
- [ ] package.json 감지 → npm install
- [ ] requirements.txt 감지 → pip install
- [ ] Cargo.toml 감지 → cargo build

#### 5.4 인증
- [ ] GitHub 토큰 저장
- [ ] GitLab 토큰 저장
- [ ] SSH 키 지원
- [ ] Private 저장소 접근

#### 5.5 추천 패키지
- [ ] 인기 스킬 목록
- [ ] 인기 MCP 목록
- [ ] 카테고리별 분류
- [ ] 검색 기능

---

### 6. 패키지 버전 관리 🆕

#### 6.1 버전 표시
- [ ] 현재 설치 버전
- [ ] 설치 일자
- [ ] 소스 저장소 링크

#### 6.2 업데이트 확인
- [ ] 원격 저장소 최신 버전 조회
- [ ] 버전 비교
- [ ] 업데이트 가능 표시
- [ ] 자동 업데이트 확인 (주기 설정)

#### 6.3 업데이트 실행
- [ ] 개별 패키지 업데이트 (git pull)
- [ ] 의존성 재설치
- [ ] 일괄 업데이트

#### 6.4 롤백
- [ ] 이전 버전 목록 표시
- [ ] 특정 버전으로 롤백 (git checkout)
- [ ] 롤백 확인 다이얼로그

---

### 7. 설정 관리 (확장) 🆕

#### 7.1 모델 설정
- [x] 기본 모델 선택 (Opus/Sonnet/Haiku) — SettingsPanel 프리셋 버튼
- [ ] 모델별 설정 (maxTokens 등)
- [x] 커스텀 모델 문자열 입력 — SettingsPanel custom input

#### 7.2 권한 설정
- [ ] allowedTools 설정
- [ ] deny 패턴 설정
- [ ] 권한 프리셋 (안전/표준/전체)

#### 7.3 CLAUDE.md 편집
- [x] 글로벌 CLAUDE.md 편집 (`~/.claude/CLAUDE.md`) — SettingsPanel Global 스코프
- [x] 프로젝트별 CLAUDE.md 편집 — SettingsPanel Project 스코프
- [x] 마크다운 에디터 — SettingsPanel textarea + Save 버튼

#### 7.4 앱 설정 (확장)
- [ ] 테마 시스템 모드 자동 전환 (다크/라이트/시스템)
- [ ] 단축키 커스터마이징
- [ ] 다국어 지원 (i18n)

---

### 8. 히스토리 (확장) 🆕

#### 8.1 세션 목록 확장
- [ ] 세션 제목 자동 생성
- [ ] 세션 프로젝트별 분류
- [ ] 세션 일시 표시 개선

#### 8.2 세션 관리 확장
- [ ] 세션 재개 (이전 대화 이어가기)
- [ ] 세션 삭제
- [ ] 세션 이름 변경

#### 8.3 세션 검색 확장
- [ ] 날짜 필터
- [ ] 프로젝트 필터

#### 8.4 세션 내보내기 확장
- [ ] 공유 링크 생성

---

### 9. 탐색기 (확장) 🆕

#### 9.1 파일 트리 개선
- [x] 숨김 파일 토글 (dotfile 표시/숨김 전환 버튼) — 설정 store `showHiddenFiles` + 탐색기 헤더 눈 아이콘 토글
- [ ] .gitignore 인식 필터링 (무시된 파일 흐리게 표시 또는 숨김)
- [ ] Collapse All / Expand All 버튼
- [ ] 정렬 옵션 (이름, 타입, 수정일, 크기)
- [ ] 파일/폴더 크기 표시 옵션
- [ ] node_modules, .git 등 대용량 폴더 자동 제외 옵션

#### 9.2 Git 상태 표시 ✅
- [x] 변경된 파일 표시 (M) — FileTreeItem git-modified 클래스
- [x] 추가된 파일 표시 (A) — FileTreeItem git-staged 클래스
- [x] 삭제된 파일 표시 (D) — FileTreeItem git-deleted 클래스
- [x] Untracked 파일 표시 (?) — FileTreeItem git-untracked 클래스
- [x] Conflict 파일 표시 (!) — FileTreeItem git-conflict 클래스
- [x] 이름변경 파일 표시 (R) — FileTreeItem git-renamed 클래스
- [x] 디렉토리에 하위 변경 전파 — dirStatuses 우선순위 기반
- [ ] 무시된 파일 흐리게 표시 (.gitignore 기반)
- [ ] Git 브랜치 표시 (헤더에 현재 브랜치명)
- [ ] Staged/Unstaged 분리 표시

#### 9.3 파일 검색
- [ ] Quick Open (Ctrl+P) — 파일명 퍼지 검색으로 빠른 파일 열기
- [ ] 트리 내 필터링 (검색어 입력 시 매칭 파일만 표시)
- [ ] 파일 내용 검색 (Ctrl+Shift+F) — grep 기반 전체 검색

#### 9.4 파일 워처 자동 갱신
- [ ] fs:watch 연동으로 외부 변경 시 자동 새로고침 (Claude가 파일 수정 시 즉시 반영)
- [ ] 변경된 파일 하이라이트 (잠시 깜빡임 효과)
- [x] 폴더 확장 상태 유지하며 갱신 — `refreshTree()` 구현 (expandedPaths 수집 후 재구성)

#### 9.5 멀티 선택 & 일괄 작업
- [x] Shift+Click 범위 선택 — `flattenVisibleNodes()` + anchor 기반 범위 계산
- [x] Ctrl+Click 개별 추가 선택 — `selectedPaths: Set<string>` 토글
- [x] 선택된 파일 일괄 복사/이동/삭제 — Ctrl+C/X/V, Delete 모두 다중 경로 지원
- [ ] 선택 파일 수 표시

#### 9.6 드래그 & 드롭
- [ ] 파일/폴더 드래그로 이동 (트리 내)
- [ ] 외부에서 파일 드롭으로 복사
- [ ] 드래그 시 이동 대상 폴더 하이라이트

#### 9.7 탐색 네비게이션
- [ ] 경로 브레드크럼 (클릭으로 상위 폴더 이동)
- [ ] 뒤로/앞으로 네비게이션 히스토리
- [ ] 즐겨찾기/북마크 (자주 접근하는 폴더 핀 고정)

#### 9.8 Claude Code 연동
- [ ] "Claude에 파일 추가" — 우클릭 → @파일경로 를 터미널 입력으로 전송
- [ ] "Claude에 폴더 추가" — 우클릭 → @폴더경로 전송
- [ ] 파일 diff 미리보기 — Git 변경 파일 클릭 시 diff 표시
- [ ] Claude 수정 파일 표시 — 현재 세션에서 Claude가 수정한 파일 아이콘 구분

#### 9.9 파일 미리보기
- [ ] 파일 선택 시 우측 미리보기 패널 (마크다운, 이미지, 코드)
- [ ] 이미지 파일 썸네일 표시 (png, jpg, svg)
- [ ] 파일 메타정보 표시 (크기, 수정일, 인코딩)

---

### 10. 컨텍스트 뷰어 🆕

#### 10.1 활성 컨텍스트
- [ ] 현재 로드된 스킬 목록
- [ ] 현재 연결된 MCP 서버 목록
- [ ] CLAUDE.md 내용 표시

#### 10.2 토큰 분포
- [ ] 스킬별 토큰 사용량
- [ ] MCP별 토큰 사용량
- [ ] 시스템 프롬프트 토큰
- [ ] 대화 토큰

#### 10.3 컨텍스트 관리
- [ ] 컨텍스트 항목 제거
- [ ] 컨텍스트 우선순위 조정
- [ ] 컨텍스트 압축

---

### 11. 단축키 (확장) 🆕

#### 사이드바 전환
- [ ] Ctrl+1 → 탐색기
- [ ] Ctrl+2 → 히스토리
- [ ] Ctrl+3 → 패키지
- [ ] Ctrl+4 → 컨텍스트
- [ ] Ctrl+5 → 설정

#### 추가 단축키
- [ ] Ctrl+Enter → 명령 전송
- [ ] Ctrl+K → 입력창 포커스
- [ ] Ctrl+L → 대화 초기화
- [ ] Ctrl+S → 세션 저장

---

### 1.3 입력 처리 (미완료분)
- [x] 명령어 자동완성 (팔레트 명령어 + Claude 슬래시 명령어 + 탭별 사용 이력)
- [x] 멀티라인 입력 지원 (Shift+Enter 줄바꿈, 줄 수 표시, 줄별 PTY 전송)

### 기타
- [ ] 플러그인 시스템
- [ ] 자동 업데이트
- [ ] 이미지 인라인 표시 (Claude 응답 내)

---

## Claude Code API 통합 기능 🔌

> `~/.claude/` 디렉토리의 파일들과 OAuth API를 활용하여 구현 가능한 기능들
> 참고: https://code.claude.com/docs

### 12. 세션 JSONL 뷰어 ✅

> `~/.claude/projects/<project-dir>/<session-id>.jsonl` 파일에서 전체 대화 히스토리 + 토큰 사용량을 읽을 수 있음

#### 12.1 세션 목록 (파일 기반)
- [x] 프로젝트별 JSONL 파일 스캔 (`~/.claude/projects/`)
- [x] 세션 목록 표시 (날짜, 크기, 첫 메시지 미리보기)
- [x] 세션 정렬 (최신순, 크기순)
- **파일**: `~/.claude/projects/<dir>/<uuid>.jsonl`
- **복잡도**: Low — **구현 완료**: IPC handlers (main.ts), SessionViewer.tsx

#### 12.2 세션 상세 보기
- [x] JSONL 파싱 → 메시지별 role/content/usage 추출
- [x] 대화 타임라인 UI (user/assistant 메시지 렌더링)
- [x] 메시지별 토큰 사용량 표시 (input/output/cache)
- [x] 총 세션 비용 계산 (모델별 단가 × 토큰)
- **복잡도**: Medium — **구현 완료**: SessionViewer.tsx (IPC 인프라만, UI 미연결)

#### 12.3 세션 분석
- [ ] 세션별 토큰 사용 차트 (시간대별)
- [ ] Tool use 빈도 분석 (어떤 도구를 많이 사용했는지)
- [ ] 모델별 사용 비교
- [ ] 프로젝트별 누적 비용
- **복잡도**: High

#### 12.4 세션 이어가기 (`--resume`)
- [x] 세션 선택 → `claude --resume <session-id>` PTY 실행
- [ ] 최근 세션 빠른 재개 버튼
- **복잡도**: Low — **구현 완료**: SessionViewer Resume 버튼

---

### 13. 파일 히스토리 뷰어 🆕

> `~/.claude/file-history/<session-id>/` 디렉토리에 Claude가 수정한 파일의 버전별 백업이 저장됨

#### 13.1 파일 변경 이력
- [ ] 세션별 수정된 파일 목록 표시
- [ ] 파일 해시 기반 버전 목록 (`<hash>@v1`, `<hash>@v2`)
- [ ] Diff 비교 (v1 vs v2, 원본 vs 수정본)
- **파일**: `~/.claude/file-history/<session-id>/<hash>@v1`
- **복잡도**: Medium

#### 13.2 파일 복원
- [ ] 특정 버전으로 파일 복원 (undo 기능)
- [ ] 복원 전 미리보기 + 확인 다이얼로그
- **복잡도**: Medium

---

### 14. 플러그인 마켓플레이스 (부분 완료)

> `~/.claude/plugins/install-counts-cache.json`에 공식 플러그인 인기도 데이터가 캐시됨

#### 14.1 플러그인 브라우저
- [x] 마켓플레이스 플러그인 목록 (official/bundled/community 3개 소스 병렬 fetch) — IPC: claude:fetchMarketplace
- [x] 플러그인 검색/필터링 — ClaudeSettingsPanel Plugins 탭 search + category filter
- [x] 카테고리별 분류 (development, productivity, security, learning, testing, database, design, deployment, monitoring)
- **소스**: GitHub marketplace.json (official ~61, bundled ~13, community)
- **복잡도**: Medium — **구현 완료**: main.ts (fetchJson + IPC), ClaudeSettingsPanel.tsx (Plugins 탭)

#### 14.2 원클릭 설치
- [x] 플러그인 선택 → `/plugin install name@marketplace` 명령 PTY 전송 — onSendCommand prop
- [ ] 설치 진행 상황 표시
- [ ] 설치된 플러그인 표시 (settings.json에서 확인)
- **복잡도**: Medium

---

### 15. Hooks 시스템 GUI 🆕

> Claude Code는 pre/post 명령 훅, 상태바 훅, 알림 훅을 지원함
> `~/.claude/settings.json` 또는 `.claude/settings.json`에서 설정

#### 15.1 Hooks 관리
- [ ] 기존 Hooks 목록 표시 (settings.json → hooks 섹션)
- [ ] Hook 추가/편집/삭제 GUI
- [ ] Hook 타입 선택 (PreToolUse, PostToolUse, Notification, StatusBar)
- [ ] Hook 매칭 규칙 편집 (matcher: tool_name, event 등)
- **파일**: `~/.claude/settings.json` → `hooks` 키
- **복잡도**: Medium

#### 15.2 StatusBar Hook 연동
- [ ] 커스텀 StatusBar hook으로 실시간 데이터 표시
- [ ] burn rate, 세션 비용 등 hook 데이터 파싱
- **복잡도**: High

---

### 16. 키바인딩 에디터 🆕

> `~/.claude/keybindings.json`으로 Claude Code의 키보드 단축키를 커스터마이징할 수 있음

#### 16.1 키바인딩 뷰어
- [x] 현재 키바인딩 목록 표시 (기본값 + 커스텀)
- [x] 컨텍스트별 분류 (Chat, Global, Confirmation, Autocomplete 등)
- **파일**: `~/.claude/keybindings.json`
- **복잡도**: Low — **구현 완료**: IPC handlers (main.ts), KeybindingsViewer.tsx (IPC 인프라만, UI 미연결)

#### 16.2 키바인딩 편집
- [ ] 키 조합 녹화 UI (키 누르면 자동 감지)
- [ ] 충돌 감지 (예약된 키, 중복 바인딩)
- [ ] keybindings.json 자동 저장
- **복잡도**: Medium

---

### 17. OAuth 토큰 관리 🆕

> `~/.claude/.credentials.json`에 OAuth 인증 정보가 저장됨

#### 17.1 인증 상태 표시
- [ ] OAuth 로그인 상태 확인 (토큰 존재 여부)
- [ ] 토큰 만료 시간 표시 (expiresAt 필드)
- [ ] StatusBar에 로그인 상태 아이콘
- **파일**: `~/.claude/.credentials.json` → `claudeAiOauth`
- **복잡도**: Low

#### 17.2 계정 정보
- [ ] 현재 구독 플랜 표시 (Pro/Max/Team)
- [ ] OAuth API로 사용자 정보 조회 (가능한 경우)
- **복잡도**: Medium

---

### 18. 슬래시 명령 통합 ✅

> Claude Code의 슬래시 명령을 GUI 버튼/팔레트로 쉽게 실행

#### 18.1 명령 팔레트 확장
- [x] Claude Code 전용 슬래시 명령 목록:
  - `/status` — 사용량 상태
  - `/cost` — 세션 비용
  - `/context` — 컨텍스트 정보
  - `/compact` — 대화 압축
  - `/clear` — 대화 초기화
  - `/config` — 설정 열기
  - `/doctor` — 진단 도구
  - `/model` — 모델 변경
  - `/vim` — vim 모드 토글
  - `/review` — 코드 리뷰
  - `/diff` — 변경사항 보기
  - `/undo` — 마지막 변경 취소
  - `/resume` — 이전 세션 재개
  - `/memory` — 자동 메모리 관리
  - `/permissions` — 권한 모드 설정
  - `/mcp` — MCP 서버 관리
  - `/stats` — 사용 통계
  - `/theme` — 테마 변경
  - `/install-github-app` — GitHub 앱 설치
- **복잡도**: Low — **구현 완료**: commands.ts (23개 슬래시 명령 + 아이콘/설명), CommandPalette.tsx (카테고리별 그룹, Tab 토글)

#### 18.2 빠른 실행 UI
- [ ] 자주 사용하는 명령 즐겨찾기/핀
- [ ] 명령 결과 파싱 + GUI 업데이트 (예: /status → StatusBar 갱신)
- [ ] 명령별 아이콘 + 설명 tooltip
- **복잡도**: Medium

---

### 19. Plan/Todo 뷰어 ✅

> `~/.claude/plans/<slug>.md` — 플랜 모드에서 생성된 계획서
> `~/.claude/todos/<session>-agent-<id>.json` — 작업 목록

#### 19.1 플랜 목록
- [x] plans/ 디렉토리 스캔 → 마크다운 파일 목록
- [x] 플랜 미리보기 (마크다운 렌더링)
- [ ] 플랜 → 실행 (세션 재개)
- **파일**: `~/.claude/plans/*.md`
- **복잡도**: Low — **구현 완료**: IPC handlers (main.ts), PlanTodoViewer.tsx (IPC 인프라만, UI 미연결)

#### 19.2 Todo 추적
- [x] todos/ 디렉토리 스캔 → JSON 파싱
- [x] 작업 목록 UI (pending/in_progress/completed)
- [x] 세션과 연결된 todo 표시
- **파일**: `~/.claude/todos/*.json`
- **복잡도**: Low — **구현 완료**: PlanTodoViewer.tsx Todos 탭

---

### 20. 글로벌 입력 히스토리 🆕

> `~/.claude/history.jsonl`에 모든 세션의 사용자 입력이 기록됨 (프로젝트/세션별 타임스탬프 포함)
> 형식: `{"display":"입력 텍스트","pastedContents":{},"timestamp":1770279627280,"project":"D:\\path","sessionId":"uuid"}`

#### 20.1 크로스세션 히스토리
- [ ] history.jsonl 파싱 → 전체 입력 히스토리 목록
- [ ] 프로젝트별 필터링
- [ ] 시간대별 검색
- [ ] 자주 사용한 프롬프트 통계
- **파일**: `~/.claude/history.jsonl`
- **복잡도**: Low

#### 20.2 프롬프트 재사용
- [ ] 이전 프롬프트 클릭 → 입력창에 붙여넣기
- [ ] 즐겨찾기 프롬프트 저장
- [ ] 프롬프트 템플릿 관리
- **복잡도**: Low~Medium

---

### 21. 커스텀 명령/스킬 레지스트리 🆕

> `~/.claude/manifest.json`에 설치된 스킬/명령의 구조화된 메타데이터가 저장됨
> `~/.claude/commands/`에 커스텀 슬래시 명령 (마크다운) 파일이 저장됨

#### 21.1 레지스트리 뷰어
- [ ] manifest.json 파싱 → 스킬/명령 목록 + 버전/설명
- [ ] 명령 파일 미리보기 (commands/*.md)
- [ ] 스킬별 파일 목록 표시
- **파일**: `~/.claude/manifest.json`, `~/.claude/commands/`
- **복잡도**: Low

---

### 22. settings.json GUI 에디터 🆕

> `~/.claude/settings.json`에 Claude Code의 전체 설정이 저장됨

#### 22.1 설정 카테고리별 편집
- [ ] `allowedTools` — 허용 도구 목록 편집
- [ ] `permissions` — 권한 모드 설정 (default/acceptEdits/plan)
- [ ] `env` — 환경변수 설정
- [ ] `hooks` — 후크 설정 (GUI)
- [ ] `mcpServers` — MCP 서버 (이미 구현된 부분 확장)
- **파일**: `~/.claude/settings.json`, `~/.claude/settings.local.json`
- **복잡도**: Medium

#### 22.2 프로젝트별 설정
- [ ] `.claude/settings.json` (프로젝트 로컬)
- [ ] `.claude/settings.local.json` (gitignore된 로컬 설정)
- [ ] 글로벌 vs 프로젝트 설정 비교 뷰
- **복잡도**: Medium

---

## 우선순위 로드맵

### Phase 1 (MVP) - 핵심 Claude 관리 ✅
> 이미 완료된 터미널 기반 위에 Claude 관리 기능 추가

1. ~~**Claude Code 정보 표시** (2.1 모델, 2.2 토큰, 2.3 컨텍스트)~~
2. ~~**기본 스킬 관리** (3.1 목록, 3.2 CRUD)~~
3. ~~**기본 MCP 관리** (4.1 목록, 4.2 CRUD)~~
4. ~~**설정 확장** (7.1 모델 설정, 7.3 CLAUDE.md 편집)~~
5. ~~**OAuth Usage API** (StatusBar 5H/7D/Sonnet 사용률 바)~~

### Phase 2 - Claude Code 딥 통합 (5/8 완료)
> OAuth API + 로컬 파일 기반 Claude Code 데이터 활용

1. ~~**세션 JSONL 뷰어** (12.1 목록, 12.2 상세)~~ ✅
2. ~~**슬래시 명령 통합** (18.1 팔레트 확장)~~ ✅
3. ~~**Plan/Todo 뷰어** (19.1 플랜, 19.2 Todo)~~ ✅
4. ~~**세션 이어가기** (12.4 `--resume`)~~ ✅
5. **글로벌 입력 히스토리** (20.1 크로스세션) — Low
6. **커스텀 명령 레지스트리** (21.1 뷰어) — Low
7. ~~**키바인딩 뷰어** (16.1 목록)~~ ✅
8. **인증 상태 표시** (17.1 OAuth 상태) — Low

### Phase 3 - 패키지 & 확장
> 외부 패키지 설치/관리 + 기존 기능 고도화

1. ~~**플러그인 마켓플레이스** (14.1 브라우저, 14.2 설치)~~ ✅ (부분)
2. **Git 패키지 설치** (5.1 URL, 5.2 자동감지, 5.3 의존성)
3. **버전 관리** (6.1 표시, 6.2 업데이트, 6.3 실행)
4. **MCP 제어/모니터링** (4.3 제어, 4.4 모니터링)
5. **탐색기 확장** (9.1 트리개선, 9.3 검색, 9.4 워처, 9.5~9.9)

### Phase 4 - 고급 기능
> 분석/최적화 + 설정 GUI

1. **세션 분석** (12.3 차트, 비용 분석) — High
2. **파일 히스토리 뷰어** (13.1, 13.2) — Medium
3. **Hooks 시스템 GUI** (15.1, 15.2) — Medium~High
4. **settings.json GUI 에디터** (20.1, 20.2) — Medium
5. **키바인딩 편집** (16.2) — Medium
6. **비용/성능 분석** (2.4 캐시, 2.5 비용, 2.6 성능)
7. **컨텍스트 뷰어** (10.1, 10.2, 10.3)
8. **히스토리 확장** (8.1~8.4)
9. **스킬 고급** (3.3 상태, 3.4 템플릿, 3.5 미리보기)
10. **권한 설정** (7.2)
11. **다국어/플러그인** (7.4 확장, 기타)

---

## 알려진 이슈 🐛

- [x] 터미널 입력이 안되는 문제 (ptyIdRef로 수정)
- [x] 폴더 열기 시 탭별 탐색기 경로가 마지막 폴더로 고정되는 버그
- [ ] Windows에서 node-pty AttachConsole 오류 (터미널 기능에는 영향 없음)
- [ ] GPU 캐시 생성 실패 경고 (앱 실행에는 영향 없음)

---

## 메모 📝

### 키보드 단축키 요약
| 단축키 | 기능 |
|--------|------|
| `Ctrl+T` | 새 탭 |
| `Ctrl+W` | 탭 닫기 |
| `Ctrl+Tab` | 다음 탭 |
| `Ctrl+Shift+Tab` | 이전 탭 |
| `Ctrl+1~9` | n번째 탭으로 이동 |
| `Ctrl+B` | 파일 탐색기 토글 |
| `Ctrl+H` | 히스토리 토글 |
| `Ctrl+,` | 설정 토글 |
| `Ctrl+\` | 가로 분할 |
| `Ctrl+Shift+\` | 세로 분할 |
| `Ctrl+Shift+P` | 명령어 팔레트 |
| `Ctrl+Shift+L` | Claude 설정 패널 토글 |
| `Ctrl+Shift+C` | Claude 빠른 실행 |
| `Ctrl+F` | 텍스트 검색 (터미널/출력/파일) |
| `Escape` | 패널 닫기 |

### 실행 방법
```bash
npm install
npm run dev
```

### 테마 캐시 리셋
```javascript
localStorage.removeItem('terminel-theme')
location.reload()
```

### ~/.claude/ 디렉토리 구조
```
~/.claude/
├── .credentials.json          # OAuth 토큰 (accessToken, refreshToken, expiresAt, subscriptionType)
├── settings.json              # 글로벌 설정 (mcpServers, hooks, allowedTools, skills)
├── settings.local.json        # 로컬 전용 설정 (gitignore)
├── stats-cache.json           # 사용 통계 캐시 (모델별 토큰, 일별 활동, longestSession)
├── keybindings.json           # 커스텀 키바인딩
├── history.jsonl              # 글로벌 입력 히스토리 (display, timestamp, project, sessionId)
├── manifest.json              # 스킬/명령 레지스트리 (버전, 설명, 파일 목록)
├── CLAUDE.md                  # 글로벌 지침 파일
├── skills/                    # 스킬 디렉토리
│   └── <skill-name>/SKILL.md
├── commands/                  # 커스텀 슬래시 명령 (*.md)
├── plugins/
│   └── install-counts-cache.json  # 플러그인 인기도 캐시
├── plans/
│   └── <slug>.md              # 플랜 모드 계획서
├── todos/
│   └── <session>-agent-<id>.json  # 작업 목록
├── projects/
│   └── <project-dir>/
│       ├── <session-id>.jsonl     # 세션 대화 로그 (메시지+토큰+모델)
│       ├── <session-id>/subagents # 서브에이전트 데이터
│       └── memory/MEMORY.md       # 프로젝트별 자동 메모리
├── file-history/
│   └── <session-id>/
│       └── <hash>@v1, @v2        # 파일 수정 버전 백업
├── debug/                     # 세션 디버그 로그 (*.txt, symlink: latest)
├── tasks/                     # 태스크 세션 상태 (.lock, .highwatermark)
├── cache/
│   └── changelog.md           # Claude Code 변경 로그
├── chrome/
│   └── chrome-native-host.bat # Chrome 연동
└── shell-snapshots/           # 셸 상태 스냅샷 (*.sh)
```

### API 엔드포인트
| 엔드포인트 | 설명 | 인증 |
|---|---|---|
| `GET /api/oauth/usage` | 5H/7D 사용률 | OAuth Bearer |

### 릴리스 히스토리
| 버전 | 날짜 | 주요 변경 |
|------|------|-----------|
| v0.5.3 | 2026-02-06 | Ctrl+F 검색, 숨김파일 토글, 파일생성 다이얼로그, Claude 관리 Phase 1 완료 |
| v0.5.2 | 2026-02-04 | 크로스 드라이브 폴더 탐색 수정 |
| v0.5.1 | 2026-02-04 | Abstracted 모드, 명령어 자동완성, 멀티라인 입력 |

### 참고 링크
- Claude Code 공식 문서: https://code.claude.com/docs
- Claude Code 슬래시 명령: https://code.claude.com/docs/en/interactive-mode
- Claude Code Hooks: https://code.claude.com/docs/en/hooks
- Claude Code 키바인딩: https://code.claude.com/docs/en/keybindings
- Claude Code 비용 관리: https://code.claude.com/docs/en/costs
- MCP 공식 저장소: https://github.com/modelcontextprotocol
