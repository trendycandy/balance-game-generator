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

        

        const prompt = `당신은 창의적이고 재미있는 밸런스 게임 질문을 만드는 전문가입니다.

주제: ${categoryDescription}
날짜 시드: ${dateSeed}

# 매우 중요한 규칙:

1. **질문 개수**: 반드시 정확히 20개를 생성하세요.

2. **선택지 길이**: 각 선택지는 최소 10자 이상, 최대 30자 이내로 작성하세요.
   - 너무 짧은 선택지 (예: "A" vs "B", "7시" vs "8시") 절대 금지
   - 구체적이고 상세하게 작성

3. **논리적 일관성 (매우 중요!)**: 두 선택지는 논리적으로 말이 되어야 합니다.
   - 나쁜 예시: "늦게 출근하는데 일찍 퇴근" (말이 안 됨)
   - 나쁜 예시: "돈을 받는데 돈을 줘야 함" (모순)
   - 좋은 예시: "일찍 출근하고 일찍 퇴근" vs "늦게 출근하고 늦게 퇴근"

4. **공정한 밸런스**: 두 선택지는 반드시 비슷한 수준의 장단점이 있어야 합니다.
   - 나쁜 예시: "100만원 받기" vs "아무것도 안 받기" (불공평)
   - 나쁜 예시: "편하게 살기" vs "고생하며 살기" (너무 명확)
   - 좋은 예시: "연봉 1억 받지만 주6일 근무" vs "연봉 5천 받지만 주4일 근무"

5. **Trade-off 구조**: 각 선택지는 "좋은 점 + 나쁜 점" 구조여야 합니다.
   - 선택지1: 장점A + 단점B
   - 선택지2: 장점C + 단점D
   - 장점과 단점의 크기가 비슷해야 함

6. **창의성**: 주제에 맞으면서도 창의적이고 고민되는 질문을 만드세요.
   - 진부하거나 뻔한 질문 금지
   - 실제로 고민될 만한 선택지 구성

# 절대 금지 사항:
❌ "늦게 출근하면서 일찍 퇴근" (논리 모순)
❌ "돈 받으면서 돈 안 냄" (일방적으로 유리)
❌ "좋은 것만 있고 나쁜 것 없음" (공정하지 않음)
❌ "A" vs "B" (너무 짧음)
❌ "편한 선택" vs "불편한 선택" (밸런스 없음)

# 좋은 질문 예시:
✅ "평생 배달음식 금지하되 집밥 무료" vs "평생 집밥 금지하되 외식 반값"
✅ "연봉 1억이지만 야근 필수" vs "연봉 5천이지만 칼퇴 보장"
✅ "텔레포트 가능하지만 하루 1회만" vs "투명화 가능하지만 30분만"
✅ "평생 라면 금지" vs "평생 치킨 금지"
✅ "1년 동안 커피 금지" vs "1년 동안 술 금지"

이제 주제에 맞는 질문 20개를 생성하세요.
반드시 위의 규칙을 모두 지켜야 합니다.

출력 형식 (JSON 배열만):
[
  {"option1": "구체적인 선택지1 (10-30자)", "option2": "구체적인 선택지2 (10-30자)"},
  ... (총 20개)
]

**최종 체크리스트**:
- [ ] 정확히 20개인가?
- [ ] 각 선택지가 10자 이상인가?
- [ ] 논리적으로 말이 되는가?
- [ ] 두 선택지가 비슷한 가치인가?
- [ ] Trade-off 구조인가?

JSON만 출력하세요:`;

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
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000
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

        let questions;
        try {
            questions = JSON.parse(jsonMatch[0]);
            console.log('파싱된 질문 개수:', questions.length);
        } catch (parseError) {
            console.error('JSON 파싱 에러:', parseError.message);
            return res.status(500).json({
                error: 'JSON 파싱 실패',
                parseError: parseError.message,
                jsonText: jsonMatch[0].substring(0, 500)
            });
        }

        // 20개 검증 및 자동 보정
        if (questions.length !== 20) {
            console.error('질문 개수 오류:', questions.length);
            
            // 19개인 경우 간단한 보정: 첫 질문 복제
            if (questions.length === 19) {
                console.log('19개 감지 - 자동 보정 시도');
                // 마지막에 하나 더 추가 (임시로 첫 번째 질문 변형)
                const extraQuestion = {
                    option1: questions[0].option1 + ' (추가)',
                    option2: questions[0].option2 + ' (추가)'
                };
                questions.push(extraQuestion);
                console.log('20개로 보정 완료');
            } else {
                // 19개가 아닌 다른 개수면 에러 반환
                return res.status(500).json({ 
                    error: `질문이 ${questions.length}개 생성되었습니다. 20개가 필요합니다.`,
                    questions 
                });
            }
        }

        // 성공 응답
        return res.status(200).json({ 
            success: true, 
            questions 
        });

    } catch (error) {
        console.error('서버 에러:', error);
        return res.status(500).json({ 
            error: '서버 에러가 발생했습니다.',
            message: error.message 
        });
    }
};
