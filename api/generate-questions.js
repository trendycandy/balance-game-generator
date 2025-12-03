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

**중요: 반드시 정확히 20개의 질문을 생성해야 합니다.**

위 주제에 맞는 고민되는 밸런스 게임 질문을 정확히 20개 생성해주세요.

규칙:
1. 각 질문은 두 선택지로 구성됩니다
2. 두 선택지는 비슷한 난이도로 고민되어야 합니다
3. 주제에 정확히 맞는 창의적이고 재미있는 질문을 만드세요
4. 각 질문은 서로 다른 내용이어야 합니다
5. 선택지는 간결하고 명확해야 합니다 (각 20자 이내)
6. **정확히 20개를 생성하세요 (매우 중요!)**

출력 형식 (JSON 배열만 출력, 20개):
[
  {"option1": "선택지1", "option2": "선택지2"},
  {"option1": "선택지1", "option2": "선택지2"},
  ... (총 20개)
]

반드시 JSON 배열만 출력하고 다른 설명은 포함하지 마세요.
배열에는 정확히 20개의 객체가 있어야 합니다.`;

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
                    option1: questi
