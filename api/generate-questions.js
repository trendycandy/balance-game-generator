// Vercel Serverless Function
// API Key를 안전하게 백엔드에서 관리

// Firebase Admin SDK import
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;

// Firebase 초기화 (Vercel 환경에서 한 번만 실행)
try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        // Vercel 환경 변수에서 Service Account JSON을 파싱
        const serviceAccount = JSON.parse(serviceAccountKey);
        // 이미 초기화되었는지 확인 (Vercel 환경에 따라 필요할 수 있음)
        if (!initializeApp.length || initializeApp.length === 0) {
              initializeApp({
                  credential: cert(serviceAccount)
              });
        }
        db = getFirestore();
        console.log("Firestore Admin initialized.");
    } else {
        console.error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. Caching will be disabled.");
    }
} catch (e) {
    console.error("Error initializing Firebase Admin:", e);
}

// 지연 함수 (delay function)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 재시도 횟수 설정
const MAX_RETRIES = 3;

// 카테고리 설명 (Cron Job에서 사용)
const CATEGORY_DESCRIPTIONS = {
    'daily': '일상생활 (음식, 수면, 생활 습관, 편의 등)',
    'ideal-male': '남자 이상형 (외모, 성격, 능력, 스타일 등)',
    'ideal-female': '여자 이상형 (외모, 성격, 능력, 스타일 등)',
    'school': '학교생활 (수업, 친구, 동아리, 시험 등)',
    'work': '회사생활 (업무, 동료, 회식, 직장 문화 등)',
    'hobby': '덕질생활 (아이돌, 콘텐츠, 굿즈, 팬덤 등)',
    // 'mahjong'은 클라이언트에서 Fallback을 사용하므로 제외
    'ability': '능력/초능력 (텔레포트, 투명화, 시간조작, 마법 등)',
    'relationship': '연애/관계 (연애 스타일, 데이트, 애정표현 등)',
    'money': '돈/재테크 (투자, 저축, 소비, 재무 목표 등)',
    'travel': '여행/레저 (여행지, 숙소, 활동, 휴가 등)',
    'game': '게임/엔터테인먼트 (게임 장르, 영화, 드라마, 유튜브 등)'
};

// JSON 스키마 정의
const QUESTION_SCHEMA = {
    type: "ARRAY",
    description: "10개의 밸런스 게임 질문 목록",
    items: {
        type: "OBJECT",
        properties: {
            "option1": { type: "STRING", description: "밸런스 게임의 첫 번째 선택지 (8~25자, 한국어)" },
            "option2": { type: "STRING", description: "밸런스 게임의 두 번째 선택지 (8~25자, 한국어)" }
        },
        required: ["option1", "option2"]
    }
};

/**
 * Gemini API를 호출하고 응답을 파싱 및 검증하는 핵심 로직
 * @param {string} prompt - Gemini에 전달할 프롬프트
 * @param {string} GEMINI_API_KEY - Gemini API 키
 * @returns {Array<Object>} 검증된 질문 배열 (10개)
 */
async function callGeminiApiAndValidate(prompt, GEMINI_API_KEY) {
    // 재시도 로직을 통해 API 호출
    const response = await callGeminiApiWithRetry(prompt, QUESTION_SCHEMA, GEMINI_API_KEY);
    
    if (!response) {
        throw new Error('AI 질문 생성 실패 (최대 재시도 횟수 초과)');
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 에러: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    // 응답 검증
    if (candidate && candidate.finishReason === 'MAX_TOKENS') {
         throw new Error('AI 응답이 최대 토큰 제한으로 인해 불완전합니다.');
    }
    if (!candidate || !candidate.content || candidate.content.parts?.length === 0 || !candidate.content.parts?.[0]?.text) {
        throw new Error('API 응답 구조가 올바르지 않습니다');
    }
    
    let responseText = candidate.content.parts[0].text;
    let rawQuestions;
    try {
        rawQuestions = JSON.parse(responseText);
        if (!Array.isArray(rawQuestions)) {
            throw new Error("API가 JSON 배열 대신 다른 형식의 JSON을 반환했습니다.");
        }
    } catch (parseError) {
        throw new Error(`JSON 파싱 실패: ${parseError.message} - 원본: ${responseText.substring(0, 50)}...`);
    }

    // 후처리 검증 로직 (기존 로직 유지)
    const validatedQuestions = rawQuestions.filter(q => {
        if (!q.option1 || !q.option2) return false;
        const opt1 = q.option1.trim();
        const opt2 = q.option2.trim();

        // 언어/길이/패턴 검증 (간략화된 버전)
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(opt1 + opt2);
        const hasChineseOrJapaneseKanji = /[\u4E00-\u9FFF]/.test(opt1 + opt2);
        const hasLongEnglish = /[a-zA-Z]{4,}/.test(opt1 + opt2);
        const koreanCount = (opt1 + opt2).match(/[가-힣]/g)?.length || 0;
        const totalLength = opt1.length + opt2.length;
        const koreanRatio = koreanCount / totalLength;

        if (hasJapanese || hasChineseOrJapaneseKanji || hasLongEnglish || koreanRatio < 0.7) return false;
        if (opt1.length < 8 || opt2.length < 8 || opt1.length > 28 || opt2.length > 28) return false;
        if (opt1 === opt2) return false;
        
        return true;
    });

    let finalQuestions = validatedQuestions.slice(0, 10);
    
    // 10개가 부족할 경우, 검증되지 않은 질문 중 일부를 보충 (최대 10개)
    if (finalQuestions.length < 10) {
        const remaining = rawQuestions.filter(q => !validatedQuestions.includes(q));
        finalQuestions = [...finalQuestions, ...remaining].slice(0, 10);
    }
    
    if (finalQuestions.length < 10) {
        throw new Error(`최종 질문 개수가 10개 미만입니다: ${finalQuestions.length}개`);
    }

    return finalQuestions;
}


// API 호출을 재시도 로직으로 감싸는 함수 (기존 함수 그대로 유지)
async function callGeminiApiWithRetry(prompt, questionSchema, GEMINI_API_KEY) {
    const fetch = (await import('node-fetch')).default;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.9,
                            responseMimeType: "application/json",
                            responseSchema: questionSchema,
                            maxOutputTokens: 8000, 
                            topP: 0.95,
                            topK: 64
                        }
                    })
                }
            );

            if (response.status === 503 || response.status === 429) {
                const delayTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`API 재시도: ${attempt + 1}/${MAX_RETRIES}, 상태 ${response.status}. ${Math.round(delayTime/1000)}초 후 재시도...`);
                await delay(delayTime);
                continue;
            }
            return response;

        } catch (error) {
            const delayTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.error(`API 호출 네트워크 에러: ${error.message}. ${Math.round(delayTime/1000)}초 후 재시도...`);
            await delay(delayTime);
            continue;
        }
    }
    return null; 
}


/**
 * Cron Job에서 호출되어 모든 카테고리 질문을 미리 생성하고 Firestore에 저장하는 함수
 */
async function preGenerateQuestions(db, GEMINI_API_KEY, dateSeed) {
    const categoriesToGenerate = Object.keys(CATEGORY_DESCRIPTIONS);

    const results = [];
    console.log(`Cron Job: ${dateSeed} 날짜의 질문 미리 생성 시작 (${categoriesToGenerate.length}개 카테고리)`);

    for (const categoryId of categoriesToGenerate) {
        const categoryDescription = CATEGORY_DESCRIPTIONS[categoryId];
        const docId = `${dateSeed}_${categoryId}`;
        const docRef = db.collection('dailyQuestions').doc(docId);
        
        try {
            // 이미 캐시되어 있는지 확인 (재실행 방지)
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                results.push({ category: categoryId, status: 'cached' });
                continue;
            }
            
            console.log(`Cron Job: ${categoryId} 질문 생성 시작...`);

            const prompt = `당신은 창의적이고 재미있는 밸런스 게임 질문을 만드는 한국어 전문가입니다.
주제: ${categoryDescription}
날짜 시드: ${dateSeed}
반드시 지켜야 할 규칙: 1. 질문 개수: 정확히 10개를 생성하세요. 2. 언어: 순수한 한국어만 사용하세요. 3. 선택지 길이: 각 선택지는 8자 이상 25자 이하로 간결하게 유지하세요. 4. 밸런스: 두 선택지는 비슷한 수준의 trade-off여야 합니다. 5. Trade-off 구조: "장점 + 단점" 또는 "서로 다른 가치" 구조여야 합니다.
**JSON 배열로만 출력하세요. 다른 설명이나 텍스트를 포함하지 마세요.**`;

            const finalQuestions = await callGeminiApiAndValidate(prompt, GEMINI_API_KEY);
            
            // Firestore에 저장
            await docRef.set({
                questions: finalQuestions,
                createdAt: new Date().toISOString(),
                generatedBy: 'CronJob'
            });
            console.log(`Cron Job: ${categoryId} 질문 생성 및 캐시 성공. (총 ${finalQuestions.length}개)`);
            results.push({ category: categoryId, status: 'generated', questionsCount: finalQuestions.length });

        } catch (error) {
            console.error(`Cron Job: ${categoryId} 질문 생성 실패:`, error.message.substring(0, 150));
            results.push({ category: categoryId, status: 'failed', error: error.message.substring(0, 150) });
        }
    }
    
    return results;
}


// 메인 핸들러 함수
module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // OPTIONS 요청 처리 (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY가 설정되지 않았습니다.');
        return res.status(500).json({ error: 'API Key가 설정되지 않았습니다.' });
    }
    
    // 현재 날짜 시드 계산
    const today = new Date();
    const dateSeed = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    

    // 1. 📢 GET 요청 처리 (Cron Job용)
    if (req.method === 'GET') {
        if (!db) {
            return res.status(500).json({ error: 'Firestore가 초기화되지 않아 Cron Job 실행 불가' });
        }

        try {
            const results = await preGenerateQuestions(db, GEMINI_API_KEY, dateSeed);
            
            const failed = results.filter(r => r.status === 'failed');

            if (failed.length > 0) {
                return res.status(207).json({ 
                    message: `일부 카테고리 질문 생성에 실패했습니다 (${failed.length}/${results.length})`,
                    details: results,
                    dateSeed: dateSeed 
                });
            }

            return res.status(200).json({ 
                message: `모든 ${results.length}개 카테고리 질문이 ${dateSeed} 날짜로 성공적으로 캐시되었습니다.`, 
                details: results,
                dateSeed: dateSeed 
            });

        } catch (cronError) {
            console.error('Cron Job 실행 중 심각한 오류 발생:', cronError);
            return res.status(500).json({ error: 'Cron Job 실행 중 심각한 서버 오류 발생', message: cronError.message });
        }
    }

    // ... (기존 코드 상단 유지) ...

    // 2. 🚀 POST 요청 처리 (클라이언트 요청용 - 캐시 히트만 허용)
    if (req.method === 'POST') {
        try {
            const { category, categoryDescription, dateSeed: requestDateSeed } = req.body;
            
            if (!category || !categoryDescription || !requestDateSeed) {
                return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
            }
            
            let finalQuestions = null;
    
            // 1. **캐싱 로직: Firestore에서 질문 확인 (필수)**
            if (db) {
                const docId = `${requestDateSeed}_${category}`;
                const docRef = db.collection('dailyQuestions').doc(docId);
                
                try {
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        finalQuestions = docSnap.data().questions;
                        console.log(`POST: 캐시 적중: ${docId}에서 질문 ${finalQuestions.length}개 로드`);
                        
                        // 캐시된 질문을 반환
                        return res.status(200).json({ 
                            success: true, 
                            questions: finalQuestions,
                            source: 'cache'
                        });
                    }
                
                    // ⚠️ 캐시 미스 발생: Cron Job이 실패했거나 아직 실행되지 않았음을 의미
                    console.warn(`POST: 캐시 미스 발생 (${docId}). 클라이언트에게 Fallback 사용 요청.`);
                
                    // 🚨 캐시 미스 시 API 호출을 건너뛰고 404를 반환하여 클라이언트가 Fallback을 사용하도록 유도
                    return res.status(404).json({
                        error: '캐시된 질문이 없습니다.', 
                        message: '오늘의 질문이 아직 생성되지 않았거나 Cron Job이 실패했습니다. 클라이언트 Fallback을 사용하세요.',
                        source: 'fallback_required'
                    });
                
                } catch (cacheError) {
                    console.error("Firestore 캐시 접근 에러:", cacheError);
                    // 캐시 접근 에러 시에도 API 호출 대신 실패 메시지 반환
                    return res.status(500).json({ 
                        error: 'Firestore 접근 실패', 
                        message: '캐시 서버에 문제가 있어 질문을 로드할 수 없습니다.' 
                    });
                }
            } else {
                 // DB가 초기화되지 않은 경우, API 호출을 시도하는 대신 에러 반환
                 console.error("Firestore가 초기화되지 않아 캐시 기능을 사용할 수 없습니다.");
                 return res.status(500).json({ error: '서버 설정 오류 (Firestore 비활성화)' });
            }
    
        } catch (error) {
            console.error('POST 요청 서버 에러:', error);
            return res.status(500).json({ 
                error: '서버 에러가 발생했습니다.',
                message: error.message 
            });
        }
    }
    // ... (기존 코드 하단 유지) ...


    // POST/GET/OPTIONS 이외의 요청 처리
    return res.status(405).json({ error: 'Method not allowed' });
};
