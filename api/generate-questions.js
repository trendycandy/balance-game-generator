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


        // JSON 스키마를 사용하므로, 프롬프트는 요구사항에 집중하고 출력 형식은 generationConfig로 전달합니다.
        const prompt = `당신은 창의적이고 재미있는 밸런스 게임 질문을 만드는 한국어 전문가입니다.

주제: ${categoryDescription}
날짜 시드: ${dateSeed}

반드시 지켜야 할 규칙:

1. 질문 개수: 정확히 10개를 생성하세요. (최종 출력 개수에 맞게 15개에서 10개로 수정)

2. 언어: 순수한 한국어만 사용하세요. 선택지에 설명이나 부연설명을 넣지 마세요.

3. 선택지 길이: 각 선택지는 8자 이상 25자 이하로 간결하게 유지하세요.

4. **밸런스 (매우 중요!)**: 두 선택지는 반드시 비슷한 수준의 trade-off를 가져야 합니다. 명백히 좋은 선택지나 나쁜 선택지를 만들지 마세요.

5. Trade-off 구조: 각 선택지는 "장점 + 단점" 또는 "서로 다른 가치" 구조여야 합니다.

**JSON 배열로만 출력하세요. 다른 설명이나 텍스트를 포함하지 마세요.**`;

        // JSON 스키마 정의
        const questionSchema = {
            type: "ARRAY",
            description: "10개의 밸런스 게임 질문 목록",
            items: {
                type: "OBJECT",
                properties: {
                    "option1": {
                        type: "STRING",
                        description: "밸런스 게임의 첫 번째 선택지 (8~25자, 한국어)"
                    },
                    "option2": {
                        type: "STRING",
                        description: "밸런스 게임의 두 번째 선택지 (8~25자, 한국어)"
                    }
                },
                required: ["option1", "option2"]
            }
        };

        // Gemini 2.5 Flash API 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                        // JSON 출력을 위해 responseMimeType 설정
                        responseMimeType: "application/json",
                        responseSchema: questionSchema,
                        // MAX_TOKENS 에러를 줄이기 위해 토큰 제한을 4000으로 충분히 설정
                        maxOutputTokens: 4000, 
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
        
        const candidate = data.candidates?.[0];

        // *** FIX 2: JSON 파싱 에러를 피하기 위해 MAX_TOKENS 검사를 최우선으로 배치 ***
        if (candidate && candidate.finishReason === 'MAX_TOKENS') {
             console.error('API 응답 불완전 (MAX_TOKENS):', JSON.stringify(data));
             return res.status(500).json({
                 error: 'AI 응답이 최대 토큰 제한으로 인해 불완전합니다. 질문 개수를 10개로 줄였으니 재시도해 주세요.',
                 response: data,
                 reason: 'MAX_TOKENS'
             });
        }
        
        // 응답 구조 검사 (MAX_TOKENS가 아닌 다른 이유로 content가 없을 때)
        if (!candidate || !candidate.content || candidate.content.parts?.length === 0 || !candidate.content.parts?.[0]?.text) {
            console.error('잘못된 API 응답 구조:', JSON.stringify(data));
            return res.status(500).json({
                error: 'API 응답 구조가 올바르지 않습니다',
                response: data
            });
        }
        
        let responseText = candidate.content.parts[0].text;
        
        // 구조화된 JSON 응답이므로, 추가적인 JSON 추출/정리 과정이 필요 없습니다.
        let rawQuestions;
        try {
            // responseText는 이미 순수한 JSON 문자열이어야 합니다.
            rawQuestions = JSON.parse(responseText);
            
            // JSON 배열만 요청했으므로, rawQuestions가 배열인지 확인
            if (!Array.isArray(rawQuestions)) {
                 throw new Error("API가 JSON 배열 대신 다른 형식의 JSON을 반환했습니다.");
            }
            
            console.log('파싱된 질문 개수:', rawQuestions.length);
        } catch (parseError) {
            console.error('JSON 파싱 에러:', parseError.message);
            // JSON 파싱 실패 시, 혹시 불완전한 JSON이라도 Fallback이 되도록 자세한 에러를 반환
            return res.status(500).json({
                error: 'JSON 파싱 실패 (AI 출력 오류)',
                parseError: parseError.message,
                jsonText: responseText.substring(0, 500)
            });
        }

        // 후처리 검증 로직 (기존 로직 유지)
        console.log('후처리 검증 시작...');
        
        // 질문 개수를 10개로 줄였으므로, 후처리 검증 후에는 10개만 남으면 됩니다.
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

            // 길이 검증 (더 엄격하게)
            if (opt1.length < 8 || opt2.length < 8) {
                console.log('제거: 너무 짧음', opt1, 'vs', opt2);
                return false;
            }
            if (opt1.length > 28 || opt2.length > 28) {
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

        // 10개 선택 (검증된 질문 중 앞에서 10개)
        let finalQuestions = validatedQuestions.slice(0, 10);

        if (finalQuestions.length < 10) {
            console.warn(`경고: 검증 후 ${finalQuestions.length}개만 남음`);
            const remaining = rawQuestions.filter(q => !validatedQuestions.includes(q));
            finalQuestions = [...finalQuestions, ...remaining].slice(0, 10);
            console.log(`보정 후: ${finalQuestions.length}개`);
        }

        if (finalQuestions.length < 10) {
            return res.status(500).json({ 
                error: `검증 후 질문이 ${finalQuestions.length}개만 남았습니다.`,
                questions: finalQuestions 
            });
        }

        console.log('최종 질문 10개 준비 완료');
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
