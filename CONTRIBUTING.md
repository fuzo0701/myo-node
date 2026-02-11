# 기여 가이드 (Contributing Guide)

묘로드 프로젝트에 관심 가져주셔서 감사합니다! 🐱

## 기여 방법

### 1. Fork & Clone

```bash
# Fork 후 클론
git clone https://github.com/your-username/myo-node.git
cd myo-node

# Upstream 저장소 추가
git remote add upstream https://github.com/fuzo0701/myo-node.git
```

### 2. 브랜치 생성

```bash
# 새 기능
git checkout -b feature/amazing-feature

# 버그 수정
git checkout -b fix/bug-description
```

### 3. 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev
```

### 4. 코드 작성

#### 코드 스타일
- TypeScript 사용
- ESLint 규칙 준수
- 의미 있는 변수명과 함수명 사용
- 복잡한 로직은 주석 추가

#### 커밋 메시지 규칙
```
<type>: <subject>

<body (optional)>
```

**Types:**
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 파일 수정

**예시:**
```
feat: Add dark mode toggle button

Add a toggle button in settings panel to switch between light and dark themes.
```

### 5. 변경사항 푸시

```bash
# 변경사항 커밋
git add .
git commit -m "feat: Add amazing feature"

# Fork한 저장소에 푸시
git push origin feature/amazing-feature
```

### 6. Pull Request 생성

- GitHub에서 Pull Request 생성
- 명확한 제목과 설명 작성
- 관련 이슈가 있다면 연결 (#이슈번호)
- 스크린샷이 있으면 더 좋습니다

## 이슈 작성

### 버그 리포트
- 재현 가능한 단계 명시
- 예상 동작 vs 실제 동작 설명
- 환경 정보 (OS, Node.js 버전 등)
- 스크린샷이나 에러 로그 첨부

### 기능 제안
- 기능의 필요성 설명
- 예상되는 사용 시나리오
- 가능하다면 구현 방법 제안

## 개발 가이드

### 프로젝트 구조
```
src/
├── main/           # Electron main process
│   ├── main.ts     # 앱 라이프사이클, IPC 핸들러
│   └── preload.ts  # Context bridge
└── renderer/       # Electron renderer process
    ├── components/ # React 컴포넌트
    ├── store/      # Zustand 상태 관리
    ├── utils/      # 유틸리티 함수
    └── styles/     # CSS 스타일
```

### 주요 패턴
- **IPC 통신**: preload.ts에서 API 노출, main.ts에서 핸들링
- **상태 관리**: Zustand + persist middleware
- **스타일링**: CSS modules 또는 global CSS

### 빌드 및 테스트

```bash
# 빌드
npm run build

# 패키징 (현재 플랫폼)
npm run package

# 특정 플랫폼
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

## 코드 리뷰

- 모든 PR은 리뷰를 거칩니다
- 건설적인 피드백을 환영합니다
- 리뷰 코멘트에 성실히 응답해주세요

## 질문이 있으신가요?

- Issue를 통해 질문하세요
- 친절하게 답변드리겠습니다!

---

**다시 한번 감사드립니다!** 여러분의 기여가 묘로드를 더 좋게 만듭니다. 🚀
