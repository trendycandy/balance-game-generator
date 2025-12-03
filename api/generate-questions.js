// Vercel Serverless Function
// API Key를 안전하게 백엔드에서 관리

export default async function handler(req, res) {
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

        const prompt = `당신은 재미있는 밸런스 게임 질문을 만드는 전문가입니다.

주제: ${categoryDescription}
날짜 시드: ${dateSeed}

위 주제에 맞는 고민되는 밸런스 게임 질문 20개를 생성해주세요.

규칙:
1. 각 질문은 두 선택지로 구성됩니다
2. 두 선택지는 비슷한 난이도로 고민되어야 합니다
3. 주제에 정확히 맞는 창의적이고 재미있는 질문을 만드세요
4. 각 질문은 서로 다른 내용이어야 합니다
5. 선택지는 구체적이지만 짧고 명확해야 합니다 (각 20자 이내)

출력 형식 (JSON만 출력):
[
  {"option1": "선택지1", "option2": "선택지2"},
  {"option1": "선택지1", "option2": "선택지2"}
]

반드시 JSON 배열만 출력하고 다른 설명은 포함하지 마세요.`;

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
                temperature: 0.8,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API 에러:', errorText);
            return res.status(response.status).json({ 
                error: 'AI 질문 생성 실패', 
                details: errorText 
            });
        }

        const data = await response.json();
        let responseText = data.choices[0].message.content;

        // JSON 추출
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        // JSON 배열 찾기
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return res.status(500).json({ 
                error: 'JSON 형식을 찾을 수 없습니다',
                rawResponse: responseText 
            });
        }

        const questions = JSON.parse(jsonMatch[0]);

        // 20개 검증
        if (questions.length !== 20) {
            return res.status(500).json({ 
                error: `질문이 ${questions.length}개 생성되었습니다. 20개가 필요합니다.`,
                questions 
            });
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
}
