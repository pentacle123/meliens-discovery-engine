# MELIENS DISCOVERY ENGINE

**Algorithm Performance Platform for Discovery Commerce**

발견 커머스를 위한 AI 기반 숏폼 콘텐츠 자동 생성 플랫폼.
멜리언스 제품별 강점 × 소비자 상황적 맥락을 AI가 매칭하여 즉각 구매를 유발하는 숏폼 아이디어를 생성합니다.

## 기능

- **제품 DNA 매트릭스**: 멜리언스 전 제품의 영상화 가능 강점 카드
- **맥락 매칭 엔진**: AI가 WHO/WHEN/WHERE/PAIN/NEED/INTEREST 6축에서 최적 조합 추천
- **숏폼 팩토리**: YouTube Shorts / Instagram Reels 숏폼 아이디어 자동 생성
- **시즌 캘린더**: 12개월 연간 콘텐츠 로드맵

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Anthropic Claude API (Server-side)
- Vercel 배포

## 로컬 개발

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일에 ANTHROPIC_API_KEY 입력

# 3. 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 확인

## Vercel 배포

1. GitHub에 push
2. Vercel에서 Import
3. Environment Variables에 `ANTHROPIC_API_KEY` 추가
4. Deploy

## Claude Code로 수정

```bash
# Claude Code에서 프로젝트 열기
claude code .

# 예시: 제품 추가
# lib/data.js의 PRODUCTS 배열에 새 제품 객체 추가

# 예시: 맥락 차원 추가
# lib/data.js의 CONTEXT_DIMS 수정

# 예시: AI 프롬프트 수정
# app/api/ai/route.js의 프롬프트 텍스트 수정
```

## 프로젝트 구조

```
meliens-discovery-engine/
├── app/
│   ├── api/ai/route.js      # AI 생성 API (서버사이드)
│   ├── globals.css           # 전역 스타일
│   ├── layout.js             # 루트 레이아웃
│   └── page.js               # 메인 페이지
├── components/
│   └── DiscoveryEngine.js    # 메인 클라이언트 컴포넌트
├── lib/
│   └── data.js               # 제품/맥락/시즌 데이터
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## 라이선스

Pentacle Internal Use Only

---

*Pentacle × AI Algorithm Performance Platform*
