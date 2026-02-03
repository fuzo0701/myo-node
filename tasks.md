# Terminel Tasks

## 완료된 기능 ✅

### 기본 구조
- [x] Electron + React + TypeScript 프로젝트 설정
- [x] Vite 빌드 설정
- [x] 크로스 플랫폼 패키징 설정 (Windows, macOS, Linux)

### 터미널
- [x] xterm.js 기반 터미널 렌더링
- [x] node-pty PTY 통신
- [x] 탭 지원 (추가/삭제/전환)
- [x] 분할 화면 (가로/세로)
- [x] 분할 화면 크기 조절 (드래그)
- [x] 커스텀 타이틀바 (윈도우 컨트롤)
- [x] 세션 복원 (앱 재시작 시 탭/작업 디렉토리 유지)
- [x] 드래그로 탭 순서 변경

### 파일 탐색기
- [x] 좌측 파일 트리 패널
- [x] 폴더 접기/펼치기
- [x] 파일 타입별 아이콘 색상 (TypeScript, JavaScript, CSS 등)
- [x] 현재 디렉토리 표시
- [x] 새로고침 버튼
- [x] 토글 버튼 (탭바)
- [x] 드래그로 패널 크기 조절
- [x] 터미널과 탐색기 디렉토리 연동

### 파일 에디터
- [x] 우측 파일 편집 패널
- [x] 파일 읽기/쓰기
- [x] 라인 넘버 표시
- [x] 수정 여부 표시 (*)
- [x] Ctrl+S 저장 단축키
- [x] 언어 타입 표시
- [x] 드래그로 패널 크기 조절

### 파일 탐색기 고급 기능
- [x] 복사/붙여넣기 (Ctrl+C, Ctrl+V)
- [x] 잘라내기 (Ctrl+X)
- [x] 컨텍스트 메뉴 (우클릭)
- [x] 새 파일/폴더 생성
- [x] 이름 바꾸기 (F2)
- [x] 삭제 (Delete)
- [x] Windows 탐색기와 클립보드 연동

### 테마
- [x] 7개 내장 테마 (Neon, Dark, Light, Monokai, Dracula, Nord, Cyberpunk)
- [x] 폰트 크기 조절
- [x] 테마 설정 영구 저장 (localStorage)
- [x] 다크 네온 스타일 리디자인 (Linear/Raycast 스타일)
- [x] ANSI 16색 팔레트 지원

### 대화 히스토리
- [x] Claude Code 출력 자동 감지
- [x] 대화 저장 (user/assistant 메시지)
- [x] 히스토리 패널 (사이드바)
- [x] 대화 검색 기능
- [x] 대화 미리보기/펼치기
- [x] 대화 상세 보기 (마크다운 렌더링)
- [x] 히스토리 영구 저장 (localStorage)

### Claude 렌더링
- [x] 3가지 렌더 모드 (Terminal, Hybrid, Rendered)
- [x] 마크다운 렌더링 (react-markdown)
- [x] 코드 블록 문법 하이라이팅 (react-syntax-highlighter)
- [x] 코드 복사 버튼
- [x] Thinking 블록 (접기/펼치기)
- [x] Tool Use 표시 (아이콘 + 파일 경로)
- [x] Diff 뷰 (추가/삭제 하이라이팅)
- [x] Error/Success 메시지 스타일링
- [x] 설정 패널
- [x] 스트리밍 렌더링 최적화 (throttling, React.memo, pre-compiled regex)

### 키보드 단축키 ⌨️
- [x] Ctrl+T: 새 탭
- [x] Ctrl+W: 현재 탭 닫기
- [x] Ctrl+Tab / Ctrl+Shift+Tab: 탭 전환
- [x] Ctrl+1~9: 특정 탭으로 이동
- [x] Ctrl+B: 파일 탐색기 토글
- [x] Ctrl+H: 히스토리 패널 토글
- [x] Ctrl+,: 설정 패널 토글
- [x] Ctrl+\: 가로 분할 토글
- [x] Ctrl+Shift+\: 세로 분할 토글
- [x] Escape: 패널 닫기

### UI 개선
- [x] SVG 아이콘 적용 (탭, 액션 버튼)
- [x] 아이콘 호버 글로우 효과
- [x] 개발 모드 스크립트 수정 (NODE_ENV 설정)
- [x] 분할 리사이저 네온 스타일

### 파싱 개선
- [x] ANSI 이스케이프 코드 제거
- [x] Claude Code 박스 드로잉 문자 지원
- [x] Tool use 패턴 인식 개선
- [x] Thinking 블록 파싱

---

## 진행 예정 기능 📋

### 우선순위 중간
- [x] 대화 내보내기 (Markdown, JSON)
- [x] 대화 즐겨찾기/태그

### 우선순위 낮음
- [x] 커스텀 테마 생성
- [ ] 플러그인 시스템
- [ ] 다국어 지원 (i18n)
- [ ] 자동 업데이트

---

## 알려진 이슈 🐛

- [x] 터미널 입력이 안되는 문제 (ptyIdRef로 수정)
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
