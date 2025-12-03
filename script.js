// 카테고리 정의
const categories = [
    { id: 'daily', name: '일상생활', emoji: '🏠' },
    { id: 'ideal-male', name: '이상형-남자', emoji: '👨' },
    { id: 'ideal-female', name: '이상형-여자', emoji: '👩' },
    { id: 'school', name: '학교생활', emoji: '🎓' },
    { id: 'work', name: '회사생활', emoji: '💼' },
    { id: 'hobby', name: '덕질생활', emoji: '⭐' },
    { id: 'mahjong', name: '리치치마작', emoji: '🀄' },
    { id: 'ability', name: '능력/초능력', emoji: '🦸' },
    { id: 'relationship', name: '연애/관계', emoji: '💕' },
    { id: 'money', name: '돈/재테크', emoji: '💰' },
    { id: 'travel', name: '여행/레저', emoji: '✈️' },
    { id: 'game', name: '게임/엔터', emoji: '🎮' }
];

// 게임 상태
let currentCategory = null;
let questions = [];
let currentQuestionIndex = 0;
let answers = [];
let todaySeed = null;

// 초기화
function init() {
    // 오늘 날짜 표시
    const today = new Date();
    todaySeed = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    document.getElementById('todayDate').textContent = 
        `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    // 카테고리 버튼 생성
    const categoryGrid = document.getElementById('categoryGrid');
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.innerHTML = `${cat.emoji} ${cat.name}`;
        btn.onclick = () => selectCategory(cat);
        categoryGrid.appendChild(btn);
    });
}

// 카테고리 선택 화면 표시
function showCategoryScreen() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'block';
}

// 카테고리 선택
async function selectCategory(category) {
    currentCategory = category;
    
    // 로딩 표시
    showLoading();

    try {
        // 캐시된 질문 확인
        const cacheKey = `questions_${category.id}_${todaySeed}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            // 캐시된 질문 사용
            questions = JSON.parse(cached);
            console.log('캐시된 질문 사용:', category.name);
        } else {
            // AI로 새 질문 생성
            await generateQuestions(category);
            // 캐시에 저장
            localStorage.setItem(cacheKey, JSON.stringify(questions));
            console.log('새 질문 생성 및 캐시 저장:', category.name);
        }
        
        // 게임 시작
        hideLoading();
        startGame();
    } catch (error) {
        hideLoading();
        alert('질문 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
        console.error(error);
    }
}

// Vercel Serverless Function으로 질문 생성
async function generateQuestions(category) {
    const categoryDescriptions = {
        'daily': '일상생활 (음식, 수면, 생활 습관, 편의 등)',
        'ideal-male': '남자 이상형 (외모, 성격, 능력, 스타일 등)',
        'ideal-female': '여자 이상형 (외모, 성격, 능력, 스타일 등)',
        'school': '학교생활 (수업, 친구, 동아리, 시험 등)',
        'work': '회사생활 (업무, 동료, 회식, 직장 문화 등)',
        'hobby': '덕질생활 (아이돌, 콘텐츠, 굿즈, 팬덤 등)',
        'mahjong': '리치마작 (좋아하는 역역, 타패 전략, 게임 상황 등)',
        'ability': '능력/초능력 (텔레포트, 투명화, 시간조작, 마법 등)',
        'relationship': '연애/관계 (연애 스타일, 데이트, 애정표현 등)',
        'money': '돈/재테크 (투자, 저축, 소비, 재무 목표 등)',
        'travel': '여행/레저 (여행지, 숙소, 활동, 휴가 등)',
        'game': '게임/엔터테인먼트 (게임 장르, 영화, 드라마, 유튜브 등)'
    };

    try {
        // Vercel Serverless Function 호출
        const response = await fetch('/api/generate-questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: category.id,
                categoryDescription: categoryDescriptions[category.id],
                dateSeed: todaySeed
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API 에러:', errorData);
            throw new Error(errorData.error || 'API 호출 실패');
        }

        const data = await response.json();
        
        if (data.success && data.questions && data.questions.length === 20) {
            questions = data.questions;
            console.log('AI 질문 생성 성공:', category.name);
        } else {
            throw new Error('질문 형식이 올바르지 않습니다');
        }
    } catch (error) {
        console.error('질문 생성 실패, Fallback 사용:', error);
        // API 실패 시 Fallback 사용
        questions = getFallbackQuestions(category.id);
    }
}

// Fallback 질문 (AI 생성 실패 시)
function getFallbackQuestions(categoryId) {
    const fallbackData = {
        'daily': [
            { option1: '평생 라면 금지', option2: '평생 치킨 금지' },
            { option1: '핸드폰 배터리 20%로 하루 버티기', option2: '와이파이 1칸으로 하루 버티기' },
            { option1: '매일 1시간 일찍 출근', option2: '매일 1시간 늦게 퇴근' },
            { option1: '1년 동안 커피 금지', option2: '1년 동안 야식 금지' },
            { option1: '방 온도 10도에서 살기', option2: '방 온도 30도에서 살기' },
            { option1: '평생 게임 금지', option2: '평생 술자리 금지' },
            { option1: '일주일 침대 없음', option2: '일주일 샤워 없음' },
            { option1: '핸드폰 카메라 사라짐', option2: '핸드폰 스피커 사라짐' },
            { option1: '오후 3시 갑자기 잠들기', option2: '새벽 3시 갑자기 깸' },
            { option1: '평생 단 음료만', option2: '평생 탄산음료만' },
            { option1: '평생 아침형 인간', option2: '평생 야행성' },
            { option1: '친구와 1주일 여행', option2: '혼자 1주일 여행' },
            { option1: '평생 교통비 무료', option2: '평생 외식비 30% 할인' },
            { option1: '하루 1시간 텔레포트', option2: '하루 1시간 투명화' },
            { option1: '평생 에어컨 없이', option2: '평생 히터 없이' },
            { option1: '평생 배달음식 금지', option2: '평생 편의점 음식만' },
            { option1: '하루 3시간만 자고 활기차게', option2: '하루 12시간 자야만 깸' },
            { option1: '매일 아침 6시 기상', option2: '매일 새벽 2시 취침' },
            { option1: '평생 짠 음식만', option2: '평생 단 음식만' },
            { option1: '일주일 말 못하기', option2: '일주일 듣지 못하기' }
        ],
        'ideal-male': [
            { option1: '키 185cm 평범한 얼굴', option2: '키 170cm 잘생긴 얼굴' },
            { option1: '운동 잘하는 남자', option2: '요리 잘하는 남자' },
            { option1: '말 많은 외향적', option2: '말 적은 내향적' },
            { option1: '연봉 1억 무뚝뚝', option2: '연봉 4천만 다정함' },
            { option1: '유머 감각 최고', option2: '책임감 최고' },
            { option1: '패션 센스 좋음', option2: '운전 실력 좋음' },
            { option1: '가족 중시', option2: '친구 중시' },
            { option1: '애교 많음', option2: '카리스마 많음' },
            { option1: '매일 연락하는', option2: '적당히 연락하는' },
            { option1: '게임 좋아함', option2: '운동 좋아함' },
            { option1: '직장인', option2: '프리랜서' },
            { option1: '계획적인', option2: '즉흥적인' },
            { option1: '부모님 살갑게', option2: '부모님 독립적' },
            { option1: '사진 잘 찍어줌', option2: '길 잘 찾음' },
            { option1: '대기업 다님', option2: '스타트업 다님' },
            { option1: '술 잘 마심', option2: '술 안 마심' },
            { option1: '강아지 좋아함', option2: '고양이 좋아함' },
            { option1: '노래 잘함', option2: '춤 잘 춤' },
            { option1: '아침형', option2: '저녁형' },
            { option1: '로맨틱함', option2: '현실적임' }
        ],
        'ideal-female': [
            { option1: '키 165cm 예쁜 얼굴', option2: '키 170cm 평범한 얼굴' },
            { option1: '요리 잘하는', option2: '청소 잘하는' },
            { option1: '명랑한 성격', option2: '차분한 성격' },
            { option1: '연봉 8천만 바쁨', option2: '연봉 3천만 여유' },
            { option1: '애교 많음', option2: '쿨함' },
            { option1: '패션 센스 좋음', option2: '화장 잘함' },
            { option1: '집순이', option2: '밖순이' },
            { option1: '사진 잘 나옴', option2: '사진 잘 찍음' },
            { option1: '매일 통화', option2: '적당히 통화' },
            { option1: '드라마 좋아함', option2: '영화 좋아함' },
            { option1: '귀여운 스타일', option2: '섹시한 스타일' },
            { option1: '계획적인', option2: '즉흥적인' },
            { option1: '독서 좋아함', option2: '운동 좋아함' },
            { option1: '요리사', option2: '디자이너' },
            { option1: '단발머리', option2: '긴 생머리' },
            { option1: '술 좋아함', option2: '커피 좋아함' },
            { option1: '강아지 키움', option2: '고양이 키움' },
            { option1: '노래방 좋아함', option2: '카페 좋아함' },
            { option1: '아침형', option2: '저녁형' },
            { option1: '감성적', option2: '이성적' }
        ],
        'school': [
            { option1: '중간고사 0점', option2: '기말고사 0점' },
            { option1: '1교시 지각 10번', option2: '조퇴 10번' },
            { option1: '체육 1등급', option2: '음악 1등급' },
            { option1: '선생님한테 혼남', option2: '친구들 앞에서 망신' },
            { option1: '급식 맛없음', option2: '급식 양 적음' },
            { option1: '학교 1km 걸어감', option2: '버스 30분 서서감' },
            { option1: '발표 많은 수업', option2: '시험 많은 수업' },
            { option1: '반장', option2: '부반장' },
            { option1: '수학 만점', option2: '영어 만점' },
            { option1: '체육대회 금메달', option2: '축제 인기상' },
            { option1: '학원 매일 10시까지', option2: '독학 매일 12시까지' },
            { option1: '조별과제 혼자 다 함', option2: '조별발표 혼자 다 함' },
            { option1: '친한 친구 3명', option2: '아는 친구 30명' },
            { option1: '쉬는시간 10분', option2: '점심시간 30분' },
            { option1: '교복 입고 등교', option2: '사복 입고 등교' },
            { option1: '1학기 선생님 좋음', option2: '2학기 선생님 좋음' },
            { option1: '수업 중 졸다 걸림', option2: '수업 중 핸드폰 걸림' },
            { option1: '야자 필수', option2: '아침 일찍 등교 필수' },
            { option1: '학교 근처 살기', option2: '학교 멀리 살기' },
            { option1: '시험 전날 벼락치기', option2: '매일 조금씩 공부' }
        ],
        'work': [
            { option1: '연봉 5천 야근 없음', option2: '연봉 8천 야근 많음' },
            { option1: '상사 좋음 동료 별로', option2: '상사 별로 동료 좋음' },
            { option1: '재택근무 매일', option2: '출근 주 2회' },
            { option1: '회의 많음', option2: '보고서 많음' },
            { option1: '점심 1시간', option2: '퇴근 30분 일찍' },
            { option1: '통근 30분 대중교통', option2: '통근 1시간 차' },
            { option1: '회식 월 1회 필수', option2: '야유회 년 1회 필수' },
            { option1: '대기업 말단', option2: '중소기업 팀장' },
            { option1: '일 재미없음 연봉 높음', option2: '일 재미있음 연봉 낮음' },
            { option1: '프로젝트형 업무', option2: '루틴형 업무' },
            { option1: '개인 책상', option2: '자유 좌석' },
            { option1: '복지 좋음 승진 느림', option2: '복지 별로 승진 빠름' },
            { option1: '야근 수당 많음', option2: '칼퇴 가능' },
            { option1: '점심 회사식당', option2: '점심 식대 지급' },
            { option1: '여름휴가 1주', option2: '겨울휴가 1주' },
            { option1: '업무 단순 반복', option2: '업무 복잡 다양' },
            { option1: '사수 엄격함', option2: '사수 자유방임' },
            { option1: '옷 자유', option2: '복장 규정 있음' },
            { option1: '스톡옵션 있음', option2: '성과급 많음' },
            { option1: '9 to 6', option2: '10 to 7' }
        ],
        'hobby': [
            { option1: '좋아하는 아이돌 만나기', option2: '콘서트 평생 무료' },
            { option1: '굿즈 무제한 구매', option2: '앨범 무제한 구매' },
            { option1: '팬싸 당첨 100%', option2: '콘서트 표 100% 구매' },
            { option1: '최애 인스타 팔로우', option2: '최애 유튜브 알림' },
            { option1: '덕질 친구 많음', option2: '덕질 혼자 조용히' },
            { option1: '컴백 년 4회', option2: '컴백 년 2회 퀄리티 높음' },
            { option1: '포카 올컴', option2: '포스터 올컴' },
            { option1: '팬카페 운영진', option2: '팬카페 회원' },
            { option1: '최애 드라마 출연', option2: '최애 예능 출연' },
            { option1: '최애 생일 축하 받음', option2: '최애에게 선물 전달' },
            { option1: '오프라인 굿즈샵', option2: '온라인 굿즈샵' },
            { option1: '최애 같은 동네 살기', option2: '최애 해외 활동 많음' },
            { option1: '최애 SNS 자주 업데이트', option2: '최애 브이로그 자주' },
            { option1: '팬미팅 자주', option2: '콘서트 자주' },
            { option1: '최애 솔로 활동', option2: '최애 그룹 활동' },
            { option1: '최애 패션 따라하기', option2: '최애 취미 따라하기' },
            { option1: '최애 굿즈 방 가득', option2: '최애 사진 방 가득' },
            { option1: '팬덤 활동 활발', option2: '팬덤 활동 조용히' },
            { option1: '최애 라디오 DJ', option2: '최애 MC' },
            { option1: '덕질 비용 무제한', option2: '덕질 시간 무제한' }
        ],
        'ability': [
            { option1: '하루 1시간 텔레포트', option2: '하루 1시간 투명화' },
            { option1: '미래 1주일 보기', option2: '과거로 1주일 돌아가기' },
            { option1: '동물과 대화', option2: '식물과 대화' },
            { option1: '하늘 날기', option2: '물속 숨쉬기' },
            { option1: '마음 읽기', option2: '기억 조작' },
            { option1: '불 조종', option2: '물 조종' },
            { option1: '시간 정지 5분', option2: '시간 되돌리기 5분' },
            { option1: '순간이동 10회', option2: '분신술 10회' },
            { option1: '변신 능력', option2: '크기 조절 능력' },
            { option1: '투시 능력', option2: '예지 능력' },
            { option1: '죽지 않음', option2: '아프지 않음' },
            { option1: '모든 언어 구사', option2: '모든 악기 연주' },
            { option1: '광속 이동', option2: '순간 학습' },
            { option1: '날씨 조종', option2: '중력 조종' },
            { option1: '기억력 완벽', option2: '체력 무한' },
            { option1: '밤에 활동력 10배', option2: '낮에 활동력 10배' },
            { option1: '모든 음식 요리', option2: '모든 음식 맛 느끼기' },
            { option1: '잠 안 자도 됨', option2: '먹지 않아도 됨' },
            { option1: '모든 악기 마스터', option2: '모든 운동 마스터' },
            { option1: '꿈 조종', option2: '감정 조종' }
        ],
        'mahjong': [
            { option1: '리치 걸면 누군가 후로', option2: '리치 걸면 100% 쯔모 못함' },
            { option1: '드림 역만 한 번 성공', option2: '평생 3판 이상 화료' },
            { option1: '동4국 1등 그러나 배패 망함', option2: '동4국 꼴지 그러나 배패 최고급' },
            { option1: '멘젠 유지 그러나 대기 약함', option2: '후로 하지만 대기 강함' },
            { option1: '탕야오 빠르게', option2: '혼일색 천천히' },
            { option1: '내 패는 최강이지만 상대도 최강', option2: '내 패는 평범한데 상대도 평범' },
            { option1: '쯔모는 잘 되지만 론을 못함', option2: '론은 잘 되지만 쯔모를 못함' },
            { option1: '도라 8장 대기패 1장', option2: '대기패 8장 도라 0장' },
            { option1: '리치 일발 쯔모.. 끝', option2: '리치 이후 10순 버티고 만관 이상 화료' },
            { option1: '패산에서 도라패가 어디 있는지 보임', option2: '상대 손패를 50% 예지 능력' },
            { option1: '양면대기4장', option2: '샤보대기4장' },
            { option1: '흐름은 좋은데 점수는 적음', option2: '점수는 큰데 흐름은 나쁨' },
            { option1: '도라 3개 들고 시작 그러나 패 형태 망함', option2: '도라 0개 그러나 형태 최상' },
            { option1: '전국치또이협회', option2: '전국또이또이협회' },
            { option1: '오프마작 리치 시 초능력으로 리치BGM 흘러나옴', option2: '화료는 잘 되지만 연출 없음' },
            { option1: '4등을 절대 안 하는 안정형', option2: '역만 한 번 터트리는 도박형' },
        ]
    };

    // 다른 카테고리도 비슷하게 추가...
    // 간단히 하기 위해 일상생활 패턴 재사용
    return fallbackData[categoryId] || fallbackData['daily'];
}

// 로딩 표시/숨김
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// 게임 시작
function startGame() {
    currentQuestionIndex = 0;
    answers = [];
    
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    showQuestion();
}

// 질문 표시
function showQuestion() {
    const question = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / 20) * 100;
    
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = 
        `${currentQuestionIndex + 1} / 20`;
    document.getElementById('questionText').textContent = 
        `${question.option1} VS ${question.option2}`;
    
    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    
    // 선택지 1
    const choice1 = document.createElement('button');
    choice1.className = 'choice-btn';
    choice1.textContent = question.option1;
    choice1.onclick = () => selectAnswer(0);
    choicesDiv.appendChild(choice1);
    
    // 선택지 2
    const choice2 = document.createElement('button');
    choice2.className = 'choice-btn';
    choice2.textContent = question.option2;
    choice2.onclick = () => selectAnswer(1);
    choicesDiv.appendChild(choice2);
}

// 답변 선택
function selectAnswer(choiceIndex) {
    answers.push(choiceIndex);
    
    if (currentQuestionIndex < 19) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        showResult();
    }
}

// 결과 표시
function showResult() {
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'block';
    
    document.getElementById('resultCategory').textContent = 
        `카테고리: ${currentCategory.emoji} ${currentCategory.name}`;
    
    const resultList = document.getElementById('resultList');
    resultList.innerHTML = '';
    
    questions.forEach((q, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'result-question';
        questionDiv.textContent = `${index + 1}. ${q.option1} VS ${q.option2}`;
        resultItem.appendChild(questionDiv);
        
        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'result-choices';
        
        const choice1 = document.createElement('div');
        choice1.className = 'result-choice' + (answers[index] === 0 ? ' selected' : '');
        choice1.textContent = q.option1;
        choicesDiv.appendChild(choice1);
        
        const choice2 = document.createElement('div');
        choice2.className = 'result-choice' + (answers[index] === 1 ? ' selected' : '');
        choice2.textContent = q.option2;
        choicesDiv.appendChild(choice2);
        
        resultItem.appendChild(choicesDiv);
        resultList.appendChild(resultItem);
    });
}

// 결과 다운로드
async function downloadResult() {
    const resultContainer = document.getElementById('resultContainer');
    
    try {
        const canvas = await html2canvas(resultContainer, {
            backgroundColor: '#f9f9f9',
            scale: 2
        });
        
        const link = document.createElement('a');
        link.download = `밸런스게임_${currentCategory.name}_${todaySeed}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (error) {
        alert('이미지 다운로드 중 오류가 발생했습니다.');
        console.error(error);
    }
}

// 다시 하기
function restartGame() {
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
    currentCategory = null;
    questions = [];
    currentQuestionIndex = 0;
    answers = [];
}

// 초기화 실행 - DOM이 완전히 로드된 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM이 이미 로드된 경우 즉시 실행
    init();
}
