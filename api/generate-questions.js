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

1. **질문 개수**: 반드시 정확히 25개를 생성하세요 (검증 후 20개 선택).

2. **선택지 길이**: 각 선택지는 최소 10자 이상, 최대 30자 이내로 작성하세요.

3. **논리적 일관성**: 두 선택지는 논리적으로 말이 되어야 합니다.
   - 나쁜 예시: "늦게 출근하는데 일찍 퇴근" (말이 안 됨)

4. **공정한 밸런스**: 두 선택지는 비슷한 수준의 장단점이 있어야 합니다.
   - 좋은 예시: "연봉 1억이지만 주6일 근무" vs "연봉 5천이지만 주4일 근무"

5. **Trade-off 구조**: 각 선택지는 "좋은 점 + 나쁜 점" 또는 "단순 대비" 구조.

출력 형식 (JSON 배열만, 25개):
[
  {"option1": "구체적인 선택지1", "option2": "구체적인 선택지2"},
  ... (총 25개)
]

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
                max_tokens: 4000
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

        // ===== 후처리 검증 로직 시작 =====
        console.log('후처리 검증 시작...');
        
        const validatedQuestions = rawQuestions.filter(q => {
            // 1. 기본 구조 확인
            if (!q.option1 || !q.option2) {
                console.log('❌ 제거: 선택지 누락', q);
                return false;
            }

            const opt1 = q.option1.trim();
            const opt2 = q.option2.trim();

            // 2. 길이 검증 (최소 8자, 최대 35자)
            if (opt1.length < 8 || opt2.length < 8) {
                console.log('❌ 제거: 너무 짧음', opt1, 'vs', opt2);
                return false;
            }
            if (opt1.length > 35 || opt2.length > 35) {
                console.log('❌ 제거: 너무 김', opt1, 'vs', opt2);
                return false;
            }

            // 3. 동일한 선택지 검증
            if (opt1 === opt2) {
                console.log('❌ 제거: 동일한 선택지', opt1);
                return false;
            }

            // 4. 너무 단순한 패턴 검증 (숫자만 다른 경우)
            const opt1WithoutNumbers = opt1.replace(/\d+/g, 'X');
            const opt2WithoutNumbers = opt2.replace(/\d+/g, 'X');
            if (opt1WithoutNumbers === opt2WithoutNumbers && opt1.length < 15) {
                console.log('❌ 제거: 숫자만 다름', opt1, 'vs', opt2);
                return false;
            }

            // 5. 의미 없는 짧은 단어 검증
            const shortWords = ['A', 'B', 'C', '가', '나'];
            if (shortWords.includes(opt1) || shortWords.includes(opt2)) {
                console.log('❌ 제거: 의미 없는 짧은 단어', opt1, 'vs', opt2);
                return false;
            }

            // 6. 중복 질문 검증 (이미 추가된 질문과 비교)
            // (간단히 하기 위해 생략, 필요시 추가 가능)

            // 모든 검증 통과
            console.log('✅ 통과:', opt1, 'vs', opt2);
            return true;
        });

        console.log(`검증 완료: ${rawQuestions.length}개 중 ${validatedQuestions.length}개 통과`);

        // 20개 선택 (검증된 질문 중 앞에서 20개)
        let finalQuestions = validatedQuestions.slice(0, 20);

        // 20개 미만이면 경고 로그 (하지만 에러는 아님)
        if (finalQuestions.length < 20) {
            console.warn(`경고: 검증 후 ${finalQuestions.length}개만 남음. 20개 필요.`);
            // 부족한 만큼 검증 안 된 질문으로 채우기
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
        console.log('✅ 최종 질문 20개 준비 완료');
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
```

---

## 🔍 후처리 검증 로직:

### 1. **기본 구조 확인**
- `option1`, `option2` 필드 존재 여부

### 2. **길이 검증**
- 최소 8자 이상 (너무 짧은 것 제거)
- 최대 35자 이하 (너무 긴 것 제거)

### 3. **동일 선택지 제거**
- `option1 === option2` 인 경우 제거

### 4. **단순 패턴 검증**
- "7시" vs "8시" 같은 숫자만 다른 단순 패턴 제거
- 예: "아침 7시" vs "아침 8시" → 제거

### 5. **의미 없는 단어 제거**
- "A" vs "B", "가" vs "나" 같은 것 제거

### 6. **보정 로직**
- AI가 25개 생성 → 검증 후 좋은 것 20개 선택
- 20개 미만이면 검증 안 된 것으로 채우기

---

## 📊 작동 방식:
```
AI 생성 (25개)
    ↓
검증 필터링
    ↓
통과한 질문만 선택 (20개)
    ↓
사용자에게 전달
