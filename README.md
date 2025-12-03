# 🎮 밸런스 게임

매일 자정마다 AI가 새롭게 생성되는 밸런스 게임! 20개의 질문에 답하고 결과를 이미지로 저장하세요.

## ✨ 주요 기능

- 🤖 **자동 생성**: 매일 새로운 질문 생성
- 📅 **하루 단위 업데이트**: 모든 사용자가 같은 날 같은 질문 공유
- 🎯 **12개 카테고리**: 일상생활, 이상형, 학교생활, 회사생활, 덕질, 능력 등
- 📥 **결과 다운로드**: 선택한 답변을 노란색 하이라이트로 이미지 저장
- 💾 **스마트 캐싱**: LocalStorage로 같은 날 재접속 시 즉시 로드
- 📱 **반응형 디자인**: 모바일/태블릿/PC 모두 지원

## 📁 프로젝트 구조

```
balance-game-project/
├── index.html          # 메인 HTML
├── styles.css          # 스타일시트
├── script.js           # JavaScript 로직
└── README.md           # 설명서
```

## 💡 작동 원리

1. **날짜 시드**: `YYYY-MM-DD` 형식의 날짜를 시드로 사용
2. **캐싱**: LocalStorage에 `questions_{category}_{date}` 형태로 저장
3. **자정 업데이트**: 날짜가 바뀌면 자동으로 새 질문 생성
4. **공유**: 모든 사용자가 같은 날 같은 질문 받음

## 🎨 커스터마이징

### 카테고리 추가
`script.js`의 `categories` 배열에 새 카테고리 추가:

```javascript
const categories = [
    { id: 'custom', name: '커스텀 카테고리', emoji: '🎉' },
    // ...
];
```

### 색상 변경
`styles.css`에서 그라데이션 색상 수정:

```css
.header {
    background: linear-gradient(135deg, #YOUR_COLOR 0%, #YOUR_COLOR 100%);
}
```

## 📄 라이선스

MIT License - 자유롭게 사용하세요!

## 🐛 이슈 제보

GitHub Issues에 버그나 기능 요청을 남겨주세요.

---

