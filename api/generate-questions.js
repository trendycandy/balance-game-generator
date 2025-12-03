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
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY가 설정되지 않았습니다.');
            return res.status(500).json({ error: 'API Key가 설정되지 않았습니다.' });
        }


        const prompt = `당신은 창의적이고 재미있는 밸런스 게임 질문을 만드는 한국어 전문가입니다.

주제: ${categoryDescription}
날짜 시드: ${dateSeed}

반드시 지켜야 할 규칙:

1. 질문 개수: 정확히 30개를 생성하세요 (검증 후 20개 선택).

2. 언어: 순수한 한국어만 사용하세요.
   - 일본어 금지, 한자 금지, 긴 영어 단어 금지
   - 한국어 문법 정확히: "~지만"은 문장 중간에만, 문장 끝은 "~음"

3. 선택지 길이: 각 선택지는 8-25자 사이. (너무 길면 안 됨!)
   - 나쁜 예: "매일 아침 든든한 한식 조식 무료 제공받음" (너무 장황)
   - 좋은 예: "매일 아침 든든한 한식 조식"
   - 나쁜 예: "매일 저녁 고급 레스토랑 외식 반값 할인받음" (너무 장황)
   - 좋은 예: "매일 저녁 고급 레스토랑 외식"

4. 간결성: 핵심만 표현하세요.
   - ✗ "~을 제공받음", "~을 할인받음", "~을 할 수 있음" 같은 불필요한 부가 설명 금지
   - ✓ 명사형으로 간결하게: "~조식", "~외식", "~능력"
   - ✗ "연봉 1억을 받지만 주6일을 근무함" (장황)
   - ✓ "연봉 1억이지만 주6일 근무" (간결)

5. 밸런스: 두 선택지는 비슷한 수준의 장단점.
   - 좋은 예: "연봉 1억이지만 주6일 근무" vs "연봉 5천이지만 주4일 근무"

6. 창의성: 재미있고 고민되는 질문.

좋은 예시 (간결함):
- "평생 라면 금지" vs "평생 치킨 금지"
- "텔레포트 능력 하루 1회" vs "투명화 능력 30분만"
- "연봉 1억이지만 주6일 근무" vs "연봉 5천이지만 주4일 근무"
- "매일 아침 한식 조식" vs "매일 저녁 레스토랑 외식"

나쁜 예시 (장황함 - 절대 하지 마세요):
- "매일 아침 든든한 한식 조식을 무료로 제공받음" (너무 김)
- "친구들과 만날 수 있지만" (문법 오류)
- "볼링을 할 수 있는 시간" (불필요한 표현)
- "공공교통기관" (한자)

출력 형식 (JSON 배열만, 30개):
[
  {"option1": "간결한 선택지1 (8-25자)", "option2": "간결한 선택지2 (8-25자)"},
  ... (총 30개)
]

JSON 배열만 출력하세요. 다른 설명 없이.`;


        // Gemini 2.5 Flash API 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 8000,
                        topP: 0.95,
                        topK: 64
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API 에러:', response.status, errorText);
            return res.status(response.status).json({ 
                error: 'AI 질문 생성 실패', 
                details: errorText,
                status: response.status
            });
        }

        const data = await response.json();
        console.log('Gemini API 응답:', JSON.stringify(data).substring(0, 200));
        
        // Gemini 응답 구조 확인
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('잘못된 API 응답 구조:', JSON.stringify(data));
            return res.status(500).json({
                error: 'API 응답 구조가 올바르지 않습니다',
                response: data
            });
        }
        
        let responseText = data.candidates[0].content.parts[0].text;
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

        // 후처리 검증 로직
        console.log('후처리 검증 시작...');
        
        const validatedQuestions = rawQuestions.filter(q => {
            if (!q.option1 || !q.option2) {
                console.log('제거: 선택지 누락', q);
                return false;
            }

            const opt1 = q.option1.trim();
            const opt2 = q.option2.trim();

            // 다국어 검증
            const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(opt1 + opt2);
            const hasChineseOrJapaneseKanji = /[\u4E00-\u9FFF]/.test(opt1 + opt2);
            const hasLongEnglish = /[a-zA-Z]{4,}/.test(opt1 + opt2);
            
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

            // 한글 비율 체크
            const koreanCount = (opt1 + opt2).match(/[가-힣]/g)?.length || 0;
            const totalLength = opt1.length + opt2.length;
            const koreanRatio = koreanCount / totalLength;
            
            if (koreanRatio < 0.7) {
                console.log('제거: 한글 비율 낮음', koreanRatio.toFixed(2), opt1, 'vs', opt2);
                return false;
            }

            // 길이 검증
            if (opt1.length < 8 || opt2.length < 8) {
                console.log('제거: 너무 짧음', opt1, 'vs', opt2);
                return false;
            }
            if (opt1.length > 35 || opt2.length > 35) {
                console.log('제거: 너무 김', opt1, 'vs', opt2);
                return false;
            }

            // 동일 선택지
            if (opt1 === opt2) {
                console.log('제거: 동일한 선택지', opt1);
                return false;
            }

            // 단순 패턴
            const opt1WithoutNumbers = opt1.replace(/\d+/g, 'X');
            const opt2WithoutNumbers = opt2.replace(/\d+/g, 'X');
            if (opt1WithoutNumbers === opt2WithoutNumbers && opt1.length < 15) {
                console.log('제거: 숫자만 다름', opt1, 'vs', opt2);
                return false;
            }

            console.log('통과:', opt1, 'vs', opt2);
            return true;
        });

        console.log(`검증 완료: ${rawQuestions.length}개 중 ${validatedQuestions.length}개 통과`);

        let finalQuestions = validatedQuestions.slice(0, 20);

        if (finalQuestions.length < 20) {
            console.warn(`경고: 검증 후 ${finalQuestions.length}개만 남음`);
            const remaining = rawQuestions.filter(q => !validatedQuestions.includes(q));
            finalQuestions = [...finalQuestions, ...remaining].slice(0, 20);
            console.log(`보정 후: ${finalQuestions.length}개`);
        }

        if (finalQuestions.length < 20) {
            return res.status(500).json({ 
                error: `검증 후 질문이 ${finalQuestions.length}개만 남았습니다.`,
                questions: finalQuestions 
            });
        }

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
