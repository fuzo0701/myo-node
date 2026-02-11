# GitHub 저장소 설정 가이드

이 파일은 GitHub 웹사이트에서 수동으로 설정해야 하는 항목들을 안내합니다.

## 필수 설정 (5분 소요)

### 1️⃣ 저장소 기본 정보 설정

**위치**: https://github.com/fuzo0701/myo-node/settings

#### About 섹션 (우측 상단)
1. **Description** 입력:
   ```
   🐱 Cross-platform terminal emulator for Claude Code - Born from the love of cats and Claude
   ```

2. **Topics** 추가 (검색 최적화):
   - `electron`
   - `terminal`
   - `claude-code`
   - `typescript`
   - `react`
   - `xterm`
   - `cross-platform`

3. **Website** (선택사항):
   - 프로젝트 홈페이지가 있다면 입력

### 2️⃣ GitHub Actions 권한 설정

**위치**: Settings > Actions > General

**필수 설정**:
- **Workflow permissions**:
  - ✅ "Read and write permissions" 선택
  - ✅ "Allow GitHub Actions to create and approve pull requests" 체크

**이유**: 릴리스 워크플로우가 GitHub Release를 생성하려면 쓰기 권한 필요

### 3️⃣ Issues 활성화 확인

**위치**: Settings > General > Features

- ✅ Issues (이미 기본으로 활성화되어 있을 것)
- ✅ Discussions (선택사항 - 커뮤니티 토론용)

## 선택 설정 (보안 강화)

### 4️⃣ Branch Protection Rules (추천)

**위치**: Settings > Branches > Add branch protection rule

**Branch name pattern**: `master`

**추천 설정**:
- ✅ **Require a pull request before merging**
  - Required approvals: `1`
- ✅ **Require status checks to pass before merging**
  - ✅ `build` (GitHub Actions 빌드가 성공해야 머지 가능)
- ✅ **Require conversation resolution before merging**
- ✅ **Do not allow bypassing the above settings** (본인도 규칙 따르기)

**주의**: 이 설정을 하면 당신도 직접 master에 푸시할 수 없고, PR을 만들어야 합니다!

### 5️⃣ Collaborators 초대 (필요시)

**위치**: Settings > Collaborators and teams

팀원을 추가하고 싶다면:
1. "Add people" 클릭
2. GitHub 유저네임 입력
3. Role 선택:
   - **Write**: 푸시 가능, 설정 변경 불가
   - **Maintain**: 이슈/PR 관리 가능
   - **Admin**: 모든 권한

## 설정 확인 방법

### Actions가 잘 작동하는지 확인:
1. https://github.com/fuzo0701/myo-node/actions 접속
2. 최근 푸시에 대한 워크플로우 실행 확인
3. ✅ 초록색이면 성공!

### 템플릿이 잘 작동하는지 확인:
1. https://github.com/fuzo0701/myo-node/issues/new/choose
2. 버그 리포트, 기능 제안 템플릿이 보이면 성공!

## 빠른 설정 체크리스트

- [ ] Description과 Topics 추가
- [ ] GitHub Actions 권한 설정 (쓰기 권한)
- [ ] Issues 활성화 확인
- [ ] Branch protection rules 설정 (선택)
- [ ] Collaborators 초대 (필요시)
- [ ] Actions 탭에서 빌드 성공 확인
- [ ] Issue 템플릿 동작 확인

---

**설정 완료 후 이 파일은 삭제하셔도 됩니다!**
