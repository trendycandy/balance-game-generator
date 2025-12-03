// Vercel Serverless Function
// API Key를 안전하게 백엔드에서 관리

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

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { category, categoryDescription, dateSeed } = req.body;

        if (!category || !categoryDescription || !dateSeed) {
            return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
        }

        // Environment Variable에서 API Key 가져오기
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            console.error('GROQ_API_KEY가 설정되지 않았습니다.');
            return res.status(500).json({ error: 'API Key가 설정되지 않았습니다.' });
        }



        const prompt = `You are a creative Korean balance game question creator.

Topic: ${categoryDescription}
Date Seed: ${dateSeed}

CRITICAL RULES - MUST FOLLOW:

1. Generate EXACTLY 30 questions (will be filtered to 20).

2. LANGUAGE: Use ONLY KOREAN (한국어). 
   - NO Japanese (日本語 禁止)
   - NO Chinese (中文 禁止)
   - NO English words longer than 3 letters
   - Examples of BANNED text: "公共交通機関", "ハイクラス", "transportation"
   - Use pure Korean: "대중교통", "고급", "이동"
   - NO TYPOS: Write correct Korean (예: "새소리" not "새송음")

3. LENGTH: Each option must be 10-30 Korean characters.

4. BALANCE: Both options must have similar trade-offs.
   - BAD: "좋은 것" vs "나쁜 것" (unfair)
   - GOOD: "아침 일찍 출근하고 일찍 퇴근" vs "늦게 출근하고 늦게 퇴근"

5. CREATIVITY: Make interesting, thought-provoking, CREATIVE choices.
   - Avoid boring comparisons like "music vs music"
   - Make meaningful contrasts with clear trade-offs

GOOD EXAMPLES (Korean only):
- "평생 배달음식 금지하되 집밥 무료" vs "평생 집밥 금지하되 외식 반값"
- "연봉 1억이지만 주6일 근무" vs "연봉 5천이지만 주4일 근무"
- "텔레포트 가능하지만 하루 1회만" vs "투명화 가능하지만 30분만"
- "평생 라면 금지" vs "평생 치킨 금지"

BAD EXAMPLES (DO NOT USE):
- "公共交通機関을 이용" (Contains Chinese)
- "ハイクラスの 차량" (Contains Japanese)
- "transportation 이용" (Contains long English)
- "새송음 듣기" vs "음악 듣기" (Typo + not creative)
- "7시 출근" vs "8시 출근" (Too simple)

OUTPUT FORMAT (JSON array only, 30 questions):
[
  {"option1": "순수 한국어 선택지1", "option2": "순수 한국어 선택지2"},
  {"option1": "순수 한국어 선택지1", "option2": "순수 한국어 선택지2"},
  ... (total 30)
]

IMPORTANT: 
- Output ONLY the JSON array. No other text.
- Use ONLY correct Korean (한글).
- Be CREATIVE and make trade-offs clear.`;

        // Groq API 호출
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are a Korean language expert. You ONLY write in Korean (한글). Never use Japanese, Chinese, or long English words."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 4500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API 에러:', response.status, errorText);
            return res.status(response.status).json({ 
                error: 'AI 질문 생성 실패', 
                details: errorText,
                status: response.status
            });
        }

        const data = await response.json();
        console.log('Groq API 응답:', JSON.stringify(data).substring(0, 200));
        
        // 응답 구조 검증
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('잘못된 API 응답 구조:', JSON.stringify(data));
            return res.status(500).json({
                error: 'API 응답 구조가 올바르지 않습니다',
                response: data
            });
        }
        
        let responseText = data.choices[0].message.content;
        console.log('응답 텍스트 길이:', responseText.length);

        // JSON 추출
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        // JSON 배열 찾기
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('JSON 매칭 실패. 원본 응답:', responseText.substring(0, 500));
            return res.status(500).json({ 
                error: 'JSON 형식을 찾을 수 없습니다',
                rawResponse: responseText.substring(0, 500)
            });
        }

        let rawQuestions;
        try {
            rawQuestions = JSON.parse(jsonMatch[0]);
            console.log('파싱된 질문 개수:', rawQuestions.length);
        } catch (parseError) {
            console.error('JSON 파싱 에러:', parseError.message);
            return res.status(500).json({
                error: 'JSON 파싱 실패',
                parseError: parseError.message,
                jsonText: jsonMatch[0].substring(0, 500)
            });
        }

        // 후처리 검증 로직 (더 엄격하게)
        console.log('후처리 검증 시작...');
        
        const validatedQuestions = rawQuestions.filter(q => {
            // 1. 기본 구조 확인
            if (!q.option1 || !q.option2) {
                console.log('제거: 선택지 누락', q);
                return false;
            }

            const opt1 = q.option1.trim();
            const opt2 = q.option2.trim();

            // 2. 다국어 검증 (가장 먼저!)
            const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(opt1 + opt2);
            const hasChineseOrJapaneseKanji = /[\u4E00-\u9FFF]/.test(opt1 + opt2);
            const hasLongEnglish = /[a-zA-Z]{4,}/.test(opt1 + opt2); // 4글자 이상 영어
            
            if (hasJapanese) {
                console.log('제거: 일본어 포함', opt1, 'vs', opt2);
                return false;
            }
            if (hasChineseOrJapaneseKanji) {
                console.log('제거: 한자 포함', opt1, 'vs', opt2);
                return false;
            }
            if (hasLongEnglish) {
                console.log('제거: 긴 영어 단어 포함', opt1, 'vs', opt2);
                return false;
            }

            // 3. 한글 비율 체크 (70% 이상이어야 함)
            const koreanCount = (opt1 + opt2).match(/[가-힣]/g)?.length || 0;
            const totalLength = opt1.length + opt2.length;
            const koreanRatio = koreanCount / totalLength;
            
            if (koreanRatio < 0.7) {
                console.log('제거: 한글 비율 낮음', koreanRatio.toFixed(2), opt1, 'vs', opt2);
                return false;
            }

            // 4. 길이 검증 (최소 8자, 최대 35자)
            if (opt1.length < 8 || opt2.length < 8) {
                console.log('제거: 너무 짧음', opt1, 'vs', opt2);
                return false;
            }
            if (opt1.length > 35 || opt2.length > 35) {
                console.log('제거: 너무 김', opt1, 'vs', opt2);
                return false;
            }

            // 5. 동일한 선택지 검증
            if (opt1 === opt2) {
                console.log('제거: 동일한 선택지', opt1);
                return false;
            }

            // 6. 너무 단순한 패턴 검증
            const opt1WithoutNumbers = opt1.replace(/\d+/g, 'X');
            const opt2WithoutNumbers = opt2.replace(/\d+/g, 'X');
            if (opt1WithoutNumbers === opt2WithoutNumbers && opt1.length < 15) {
                console.log('제거: 숫자만 다름', opt1, 'vs', opt2);
                return false;
            }

            // 7. 의미 없는 짧은 단어 검증
            const shortWords = ['A', 'B', 'C', '가', '나'];
            if (shortWords.includes(opt1) || shortWords.includes(opt2)) {
                console.log('제거: 의미 없는 짧은 단어', opt1, 'vs', opt2);
                return false;
            }

            // 모든 검증 통과
            console.log('통과:', opt1, 'vs', opt2);
            return true;
        });

        console.log(`검증 완료: ${rawQuestions.length}개 중 ${validatedQuestions.length}개 통과`);

        // 20개 선택
        let finalQuestions = validatedQuestions.slice(0, 20);

        // 20개 미만이면 보정
        if (finalQuestions.length < 20) {
            console.warn(`경고: 검증 후 ${finalQuestions.length}개만 남음. 20개 필요.`);
            const remaining = rawQuestions.filter(q => !validatedQuestions.includes(q));
            finalQuestions = [...finalQuestions, ...remaining].slice(0, 20);
            console.log(`보정 후: ${finalQuestions.length}개`);
        }

        // 여전히 20개 미만이면 에러
        if (finalQuestions.length < 20) {
            return res.status(500).json({ 
                error: `검증 후 질문이 ${finalQuestions.length}개만 남았습니다.`,
                questions: finalQuestions 
            });
        }

        // 성공 응답
        console.log('최종 질문 20개 준비 완료');
        return res.status(200).json({ 
            success: true, 
            questions: finalQuestions 
        });

    } catch (error) {
        console.error('서버 에러:', error);
        return res.status(500).json({ 
            error: '서버 에러가 발생했습니다.',
            message: error.message 
        });
    }
};
