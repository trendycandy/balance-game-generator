// 카테고리 정의 (HTML에서 버튼 생성에 사용) 수정테스트
const categories = [
    { id: 'daily', name: '일상생활', emoji: '🏠' },
    { id: 'ideal-male', name: '이상형-남자', emoji: '👨' },
    { id: 'ideal-female', name: '이상형-여자', emoji: '👩' },
    { id: 'school', name: '학교생활', emoji: '🎓' },
    { id: 'work', name: '회사생활', emoji: '💼' },
    { id: 'hobby', name: '덕질생활', emoji: '⭐' },
    { id: 'mahjong', name: '리치마작', emoji: '🀄' },
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
    // 오늘 날짜 표시 및 시드 설정
    const today = new Date();
    // Vercel Cron Job과 Firebase 캐시 키가 이 시드를 기준으로 작동합니다.
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
    
    // 페이지 로드 시 시작 화면 표시
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';
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
        // 클라이언트 측 캐시 확인
        const cacheKey = `questions_${category.id}_${todaySeed}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            // 1. 클라이언트 캐시 적중: 저장된 질문 사용
            questions = JSON.parse(cached);
            console.log('클라이언트 캐시된 질문 사용:', category.name);
        } else {
            // 2. 클라이언트 캐시 미스: 서버에 질문 요청
            await generateQuestions(category);
            
            // 서버에서 새로 생성/가져온 질문을 클라이언트 캐시에 저장
            localStorage.setItem(cacheKey, JSON.stringify(questions));
            console.log('서버에서 질문 로드 후 클라이언트 캐시 저장:', category.name);
        }
        
        // 게임 시작
        hideLoading();
        startGame();
    } catch (error) {
        hideLoading();
        alert('질문 로드 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        console.error("질문 로드 오류:", error);
    }
}



// script.js 내 generateQuestions 함수 수정
async function generateQuestions(category) {
    // 🀄 마작 카테고리는 미리 준비된 질문만 사용 (AI 생성 건너뛰기)
    if (category.id === 'mahjong') {
        console.log('마작 카테고리: 미리 준비된 Fallback 질문 사용');
        questions = getFallbackQuestions('mahjong');
        return;
    }

    // ... (categoryDescriptions 객체는 그대로 유지) ...

    try {
        // Vercel Serverless Function 호출
        const response = await fetch('/api/generate-questions', {
            method: 'POST',
            // ... (headers 및 body는 그대로 유지)
        });

        if (!response.ok) {
            const errorData = await response.json();
            
            // 🚨 서버가 404(Not Found)를 반환하면 Fallback을 사용하도록 처리
            if (response.status === 404 && errorData.source === 'fallback_required') {
                 console.warn(`서버 캐시 미스. Fallback 질문 사용을 위해 오류 발생: ${errorData.message}`);
                 throw new Error('SERVER_CACHE_MISS'); // 사용자 정의 에러 발생
            }

            console.error('API 에러:', errorData);
            throw new Error(errorData.error || 'API 호출 실패');
        }

        const data = await response.json();
        
        if (data.success && data.questions && data.questions.length === 10) {
            questions = data.questions;
            console.log(`서버 응답 성공: ${data.source} (${category.name})`);
        } else {
            throw new Error('질문 형식이 올바르지 않거나 10개 미만입니다');
        }
    } catch (error) {
        // 404 Fallback 에러 또는 기타 API 실패 시 Fallback 질문 사용
        if (error.message === 'SERVER_CACHE_MISS' || error.message !== 'API 호출 실패') {
            console.error('질문 생성 실패, Fallback 사용:', error.message);
            questions = getFallbackQuestions(category.id);
        } else {
             // 기타 예상치 못한 네트워크/파싱 오류는 다시 던져서 사용자에게 알림
             throw error;
        }
    }
}


// Fallback 질문 (AI 생성 실패 시) - 20개 중 랜덤 10개 선택
function getFallbackQuestions(categoryId) {
    const fallbackData = {
        'daily': [
            { option1: '평생 라면 금지', option2: '평생 치킨 금지' },
            { option1: '핸드폰 배터리 20%로 하루', option2: '와이파이 1칸으로 하루' },
            { option1: '매일 1시간 일찍 출근', option2: '매일 1시간 늦게 퇴근' },
            { option1: '1년 동안 커피 금지', option2: '1년 동안 야식 금지' },
            { option1: '방 온도 10도', option2: '방 온도 30도' },
            { option1: '평생 게임 금지', option2: '평생 술 금지' },
            { option1: '일주일 침대 없음', option2: '일주일 샤워 없음' },
            { option1: '핸드폰 카메라 사라짐', option2: '핸드폰 스피커 사라짐' },
            { option1: '오후 3시 갑자기 잠듦', option2: '새벽 3시 갑자기 깸' },
            { option1: '평생 단 음료만', option2: '평생 탄산음료만' },
            { option1: '평생 아침형 인간', option2: '평생 야행성' },
            { option1: '친구와 1주일 여행', option2: '혼자 1주일 여행' },
            { option1: '평생 교통비 무료', option2: '평생 외식비 30% 할인' },
            { option1: '하루 1시간 텔레포트', option2: '하루 1시간 투명화' },
            { option1: '평생 에어컨 없이', option2: '평생 히터 없이' },
            { option1: '평생 배달음식 금지', option2: '평생 편의점 음식만' },
            { option1: '하루 3시간만 자고 활기참', option2: '하루 12시간 자야 깸' },
            { option1: '매일 아침 6시 기상', option2: '매일 새벽 2시 취침' },
            { option1: '평생 짠 음식만', option2: '평생 단 음식만' },
            { option1: '일주일 말 못함', option2: '일주일 듣지 못함' }
        ],
        'ideal-male': [
            { option1: '키 185cm 평범한 얼굴', option2: '키 170cm 잘생긴 얼굴' },
            { option1: '운동 잘하는 남자', option2: '요리 잘하는 남자' },
            { option1: '말 많은 외향적', option2: '말 적은 내향적' },
            { option1: '연봉 1억 무뚝뚝', option2: '연봉 4천 다정함' },
            { option1: '유머 감각 최고', option2: '책임감 최고' },
            { option1: '패션 센스 좋음', option2: '운전 실력 좋음' },
            { option1: '가족 중시', option2: '친구 중시' },
            { option1: '애교 많음', option2: '카리스마 많음' },
            { option1: '매일 연락함', option2: '적당히 연락함' },
            { option1: '게임 좋아함', option2: '운동 좋아함' },
            { option1: '직장인', option2: '프리랜서' },
            { option1: '계획적임', option2: '즉흥적임' },
            { option1: '부모님께 살갑게', option2: '부모님께 독립적' },
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
            { option1: '요리 잘함', option2: '청소 잘함' },
            { option1: '명랑한 성격', option2: '차분한 성격' },
            { option1: '연봉 8천 바쁨', option2: '연봉 3천 여유' },
            { option1: '애교 많음', option2: '쿨함' },
            { option1: '패션 센스 좋음', option2: '화장 잘함' },
            { option1: '집순이', option2: '밖순이' },
            { option1: '사진 잘 나옴', option2: '사진 잘 찍음' },
            { option1: '매일 통화', option2: '적당히 통화' },
            { option1: '드라마 좋아함', option2: '영화 좋아함' },
            { option1: '귀여운 스타일', option2: '섹시한 스타일' },
            { option1: '계획적임', option2: '즉흥적임' },
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
            { option1: '좋아하는 아이돌 만남', option2: '콘서트 평생 무료' },
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
            { option1: '동4국 1등 배패 망함', option2: '동4국 꼴지 배패 최고급' },
            { option1: '멘젠 유지 대기 약함', option2: '후로 하지만 대기 강함' },
            { option1: '탕야오 빠르게', option2: '혼일색 천천히' },
            { option1: '내 패 최강 상대도 최강', option2: '내 패 평범 상대도 평범' },
            { option1: '쯔모는 잘 됨 론 못함', option2: '론은 잘 됨 쯔모 못함' },
            { option1: '도라 8장 대기패 1장', option2: '대기패 8장 도라 0장' },
            { option1: '리치 일발 쯔모 끝', option2: '리치 후 10순 버팀 만관' },
            { option1: '패산 도라패 위치 보임', option2: '상대 손패 50% 예지' },
            { option1: '양면대기 4장', option2: '샤보대기 4장' },
            { option1: '흐름 좋음 점수 적음', option2: '점수 큼 흐름 나쁨' },
            { option1: '도라 3개 형태 망함', option2: '도라 0개 형태 최상' },
            { option1: '전국치또이협회', option2: '전국또이또이협회' },
            { option1: '리치 시 BGM 흐름', option2: '화료 잘 됨 연출 없음' },
            { option1: '4등 절대 안 함', option2: '역만 한 번 터트림' },
            { option1: '평생 역만만 노림', option2: '평생 탕야오만 화료' },
            { option1: '치 안 하는 멘젠주의', option2: '치폰깡 다 하는 후로파' },
            { option1: '평생 선입 1위', option2: '평생 역전 1위' },
            { option1: '평생 도라만 잡힘', option2: '평생 대기패 많음' }
        ],
        'relationship': [
            { option1: '매일 만남', option2: '주 1회 만남' },
            { option1: '스킨십 많음', option2: '스킨십 적음' },
            { option1: '매일 연락', option2: '필요할 때만 연락' },
            { option1: '이벤트 중시', option2: '일상 중시' },
            { option1: '질투 많음', option2: '질투 없음' },
            { option1: '싸우면 먼저 사과', option2: '싸우면 시간 필요' },
            { option1: '연애 공개적', option2: '연애 비밀' },
            { option1: '여행 자주', option2: '집데이트 자주' },
            { option1: '선물 자주', option2: '편지 자주' },
            { option1: '핸드폰 공유', option2: '핸드폰 개인적' },
            { option1: '친구 소개 빠름', option2: '친구 소개 천천히' },
            { option1: '결혼 빨리', option2: '결혼 천천히' },
            { option1: '애정표현 자주', option2: '애정표현 적게' },
            { option1: '미래 계획 구체적', option2: '미래 계획 여유롭게' },
            { option1: '기념일 챙김', option2: '기념일 자유롭게' },
            { option1: '데이트 비용 반반', option2: '데이트 비용 번갈아' },
            { option1: '취미 같이', option2: '취미 각자' },
            { option1: '부모님 빨리 만남', option2: '부모님 천천히 만남' },
            { option1: '동거 빠름', option2: '동거 결혼 후' },
            { option1: '갈등 즉시 해결', option2: '갈등 시간 두고 해결' }
        ],
        'money': [
            { option1: '월급 5천 안정적', option2: '프리랜서 변동 많음' },
            { option1: '저축 많이', option2: '투자 많이' },
            { option1: '주식 투자', option2: '부동산 투자' },
            { option1: '작은 돈 자주 벌기', option2: '큰 돈 가끔 벌기' },
            { option1: '용돈 매달 정해짐', option2: '용돈 필요할 때' },
            { option1: '명품 하나', option2: '실용품 여러 개' },
            { option1: '저축 50%', option2: '소비 50%' },
            { option1: '현금 사용', option2: '카드 사용' },
            { option1: '재테크 공부', option2: '재테크 전문가 상담' },
            { option1: '연봉 1억 스트레스', option2: '연봉 5천 여유' },
            { option1: '보험 많이', option2: '보험 최소' },
            { option1: '가계부 작성', option2: '자유롭게 소비' },
            { option1: '할인 쿠폰 챙김', option2: '할인 신경 안 씀' },
            { option1: '경제적 독립 빠름', option2: '경제적 독립 천천히' },
            { option1: '비상금 많음', option2: '비상금 적음' },
            { option1: '은행 적금', option2: '코인 투자' },
            { option1: '월급 통장 분리', option2: '월급 통장 하나' },
            { option1: '목표 저축액 정함', option2: '목표 저축액 자유' },
            { option1: '재테크 앱 사용', option2: '재테크 수기 관리' },
            { option1: '연금 일찍 준비', option2: '연금 나중에 준비' }
        ],
        'travel': [
            { option1: '국내 여행 자주', option2: '해외 여행 가끔' },
            { option1: '계획적 여행', option2: '즉흥적 여행' },
            { option1: '호텔 숙박', option2: '게스트하우스 숙박' },
            { option1: '유명 관광지', option2: '로컬 장소' },
            { option1: '여행 사진 많이', option2: '여행 사진 적게' },
            { option1: '액티비티 많음', option2: '휴식 많음' },
            { option1: '맛집 투어', option2: '카페 투어' },
            { option1: '혼자 여행', option2: '친구와 여행' },
            { option1: '배낭 여행', option2: '캐리어 여행' },
            { option1: '자연 여행', option2: '도시 여행' },
            { option1: '여름 여행', option2: '겨울 여행' },
            { option1: '등산', option2: '해변' },
            { option1: '패키지 여행', option2: '자유 여행' },
            { option1: '역사 문화 투어', option2: '쇼핑 투어' },
            { option1: '아침 일찍 출발', option2: '여유롭게 출발' },
            { option1: '렌터카 여행', option2: '대중교통 여행' },
            { option1: '여행 블로그 작성', option2: '여행 기억만' },
            { option1: '럭셔리 여행', option2: '가성비 여행' },
            { option1: '단기 여행 자주', option2: '장기 여행 가끔' },
            { option1: '여행 계획 꼼꼼히', option2: '여행 계획 대충' }
        ],
        'game': [
            { option1: 'RPG 게임', option2: 'FPS 게임' },
            { option1: 'PC 게임', option2: '모바일 게임' },
            { option1: '싱글 플레이', option2: '멀티 플레이' },
            { option1: '스토리 중시', option2: '플레이 중시' },
            { option1: '게임 매일 1시간', option2: '게임 주말 몰아서' },
            { option1: '게임 유료 결제', option2: '게임 무과금' },
            { option1: '공포 게임', option2: '힐링 게임' },
            { option1: '경쟁 게임', option2: '협동 게임' },
            { option1: '고사양 게임', option2: '저사양 게임' },
            { option1: '최신 게임', option2: '고전 게임' },
            { option1: '게임 방송 보기', option2: '게임 직접 하기' },
            { option1: '영화 보기', option2: '드라마 보기' },
            { option1: '넷플릭스', option2: '유튜브' },
            { option1: '액션 영화', option2: '로맨스 영화' },
            { option1: '애니메이션', option2: '다큐멘터리' },
            { option1: '예능 프로그램', option2: '뉴스 보기' },
            { option1: '팟캐스트 듣기', option2: '음악 듣기' },
            { option1: '웹툰 보기', option2: '웹소설 보기' },
            { option1: '스포츠 관람', option2: '공연 관람' },
            { option1: '게임 커뮤니티 활동', option2: '게임 혼자 즐기기' }
        ]
    };

    const allQuestions = fallbackData[categoryId] || fallbackData['daily'];
    
    // 날짜 기반 시드로 랜덤하게 10개 선택 (같은 날짜면 같은 질문)
    const randomIndices = seededShuffle([...Array(allQuestions.length).keys()], todaySeed).slice(0, 10);
    
    return randomIndices.map(i => allQuestions[i]);
}

// 시드 기반 셔플 함수 (같은 날짜면 같은 순서)
function seededShuffle(array, seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    
    const random = () => {
        hash = (hash * 9301 + 49297) % 233280;
        return hash / 233280;
    };
    
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
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
    const totalQuestions = questions.length;
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = 
        `${currentQuestionIndex + 1} / ${totalQuestions}`; // 10개로 수정
    document.getElementById('questionText').textContent = 
        `${question.option1} VS ${question.option2}`;
    
    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    
    const choice1 = document.createElement('button');
    choice1.className = 'choice-btn';
    choice1.textContent = question.option1;
    choice1.onclick = () => selectAnswer(0);
    choicesDiv.appendChild(choice1);
    
    const choice2 = document.createElement('button');
    choice2.className = 'choice-btn';
    choice2.textContent = question.option2;
    choice2.onclick = () => selectAnswer(1);
    choicesDiv.appendChild(choice2);
}

// 답변 선택
function selectAnswer(choiceIndex) {
    answers.push(choiceIndex);
    
    // 질문 개수가 10개로 고정되었으므로 questions.length를 사용
    if (currentQuestionIndex < questions.length - 1) { 
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
        // html2canvas는 전역으로 로드되었다고 가정
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

// 다시 하기 (처음 화면으로)
function restartGame() {
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
    currentCategory = null;
    questions = [];
    currentQuestionIndex = 0;
    answers = [];
    // 로컬 스토리지는 유지 (하루 동안 같은 질문을 받도록)
}

// 게임 중 카테고리로 돌아가기
function backToCategory() {
    if (confirm('진행 중인 게임이 초기화됩니다. 카테고리 선택으로 돌아가시겠습니까?')) {
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('categoryScreen').style.display = 'block';
        
        currentCategory = null;
        questions = [];
        currentQuestionIndex = 0;
        answers = [];
    }
}

// 결과 화면에서 다른 카테고리로 이동
function goToCategory() {
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'block';
    
    currentCategory = null;
    questions = [];
    currentQuestionIndex = 0;
    answers = [];
}

// 초기화 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
