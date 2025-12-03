// 유저 응답 로깅 API
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { category, questionIndex, choice, timestamp } = req.body;

        // 로그 출력 (Vercel 대시보드에서 확인 가능)
        console.log('=== 유저 응답 ===');
        console.log('카테고리:', category);
        console.log('질문 번호:', questionIndex);
        console.log('선택:', choice);
        console.log('시간:', new Date(timestamp).toLocaleString('ko-KR'));
        console.log('================');

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('로깅 에러:', error);
        return res.status(500).json({ error: error.message });
    }
};
