const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // 이미지 업로드용 라이브러리
const app = express();
const PORT = 3000;

// 시작 메시지 - 서버가 켜지는지 확인용
console.log("---------------------------------");
console.log("🚀 서버 초기화 시작...");

app.use(express.json({ limit: '100mb' }));

// [핵심 수정] 정적 파일 제공 설정 보강
app.use(express.static(path.join(__dirname))); 
// 브라우저에서 /json/파일명.json으로 접근할 때 실제 폴더와 연결하고 캐시를 차단함
app.use('/json', express.static(path.join(__dirname, 'json'), { etag: false, lastModified: false }));

// 메타데이터 및 주요 파일 경로 지정
const jsonDir = path.join(__dirname, 'json');
const metaPath = path.join(jsonDir, 'metadata.json'); 
const membersPath = path.join(jsonDir, 'members.json'); 
const bookingsPath = path.join(jsonDir, 'bookings.json'); 
const depositPath = path.join(jsonDir, 'deposit.json'); // 입금 내역 경로 추가
const withdrawPath = path.join(jsonDir, 'withdraw.json'); // 출금 내역 경로 추가
const reviewsPath = path.join(jsonDir, 'reviews.json'); // 리뷰 내역 경로 추가
const productsPath = path.join(jsonDir, 'products.json'); // 상품 정보 경로를 실제 파일명인 products.json으로 수정
const supportPath = path.join(jsonDir, 'support.json'); // 1:1 문의 내역 경로 추가

// 필수 폴더 생성 (images, json)
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}
if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
}

// 이미지 저장 설정 (multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/'); 
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const productCode = req.body.productCode || 'temp';
        const index = req.body.index || Date.now();
        cb(null, `${productCode}_${index}${ext}`);
    }
});
const upload = multer({ storage: storage });

// [기존 유지] 이미지 업로드 API
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "파일이 없습니다." });
    const imagePath = `/images/${req.file.filename}`;
    console.log(`📸 이미지 업로드 완료: ${imagePath}`);
    res.json({ success: true, path: imagePath });
});

// [기존 유지] 회원가입 API
app.post('/signup', (req, res) => {
    const newMember = req.body;
    let members = [];

    if (fs.existsSync(membersPath)) {
        try {
            const content = fs.readFileSync(membersPath, 'utf8');
            members = content ? JSON.parse(content) : [];
        } catch (e) { members = []; }
    }

    members.push(newMember);

    fs.writeFile(membersPath, JSON.stringify(members, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("회원가입 저장 실패:", err);
            return res.status(500).send('저장 실패');
        }
        console.log(`👤 새 회원 등록 완료: ${newMember["아이디"]}`);
        res.send('가입 성공');
    });
});

// [기존 유지] 로그인 API
app.post('/login', (req, res) => {
    const { 아이디, 비밀번호 } = req.body;
    
    if (!fs.existsSync(membersPath)) {
        return res.status(400).json({ success: false, message: "회원 정보가 없습니다." });
    }

    try {
        const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
        const user = members.find(m => m["아이디"] === 아이디 && m["비밀번호"] === 비밀번호);

        if (user) {
            if (user["접근차단"] === "차단") {
                return res.status(403).json({ success: false, message: "접근이 차단된 계정입니다." });
            }
            console.log(`🔑 로그인 성공: ${아이디}`);
            res.json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "서버 데이터 오류" });
    }
});

// [기존 유지] 비밀번호 찾기 API
app.get('/find-pw', (req, res) => {
    const id = req.query.id;
    if (!fs.existsSync(membersPath)) return res.json({ success: false, message: "회원 정보 없음" });

    try {
        const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
        const user = members.find(m => m["아이디"] === id);

        if (user) {
            res.json({ success: true, pw: user["비밀번호"] });
        } else {
            res.json({ success: false, message: "일치하는 아이디가 없습니다." });
        }
    } catch (e) {
        res.json({ success: false, message: "데이터 읽기 오류" });
    }
});

// [기존 유지] 회원 정보 수정 API
app.post('/update-profile', (req, res) => {
    const updatedData = req.body;
    const targetId = updatedData["아이디"];

    if (!fs.existsSync(membersPath)) {
        return res.status(400).json({ success: false, message: "회원 정보 파일이 없습니다." });
    }

    try {
        let members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
        const userIndex = members.findIndex(m => m["아이디"] === targetId);

        if (userIndex !== -1) {
            if (!updatedData["비밀번호"]) {
                updatedData["비밀번호"] = members[userIndex]["비밀번호"];
            }
            members[userIndex] = { ...members[userIndex], ...updatedData };
            fs.writeFileSync(membersPath, JSON.stringify(members, null, 2), 'utf8');
            console.log(`📝 회원 정보 수정 완료: ${targetId}`);
            res.json({ success: true, user: members[userIndex] });
        } else {
            res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }
    } catch (e) {
        console.error("정보 수정 중 오류:", e);
        res.status(500).json({ success: false, message: "서버 오류 발생" });
    }
});

// [수정 핵심] 데이터 저장 API 
app.post('/save-json', (req, res) => {
    const { filename, data, displayName } = req.body; 
    let pureFilename = filename.replace('.csv', '.json');
    if (!pureFilename.endsWith('.json')) pureFilename += '.json';
    const filePath = path.join(jsonDir, pureFilename);

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        
        if (displayName) {
            let metadata = {};
            if (fs.existsSync(metaPath)) {
                try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
            }
            metadata[pureFilename] = displayName;
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
        }

        console.log(`✅ ${pureFilename} 저장 완료! (항목: ${data.length}개)`);
        res.send('저장 성공!');
    } catch (err) {
        console.error("저장 중 시스템 에러:", err);
        res.status(500).send('저장 실패');
    }
});

// [기존 유지] 예약 정보 전송 API
app.post('/api/booking', (req, res) => {
    const d = req.body;
    const newBooking = {
        "아이디": d["아이디"] || d.nickname || "guest",
        "상품명": d["상품명"] || d.productName || "",
        "성인수": String(d["성인수"] || d.adultCount || "0"),
        "아동수": String(d["아동수"] || d.childCount || "0"),
        "총금액": String(d["총금액"] || d.total_price || "0"),
        "이미지": d["이미지"] || d.productImg || "",
        "예약번호": d["예약번호"] || d.reservation_no || "",
        "결제수단": d["결제수단"] || d.payment || "",
        "출발날짜": d["출발날짜"] || d.travel_date || "",
        "예약상태": d["예약상태"] || d.status || "예약접수",
        "신청일": d["신청일"] || new Date().toLocaleString()
    };

    let bookings = [];
    if (fs.existsSync(bookingsPath)) {
        try {
            const content = fs.readFileSync(bookingsPath, 'utf8');
            bookings = content ? JSON.parse(content) : [];
        } catch (e) { bookings = []; }
    }
    bookings.push(newBooking);

    fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("예약 저장 실패:", err);
            return res.status(500).json({ success: false });
        }
        console.log(`🎫 새 예약 등록 완료: ${newBooking["예약번호"]} (ID: ${newBooking["아이디"]})`);
        res.json({ success: true });
    });
});

// [추가] 입금 신청 정보 전송 API
app.post('/api/deposit', (req, res) => {
    const d = req.body;
    const newDeposit = {
        "아이디": d["아이디"] || "guest",
        "닉네임": d["닉네임"] || "회원",
        "입금자명": d["입금자명"] || "",
        "금액": Number(d["금액"] || 0),
        "상태": d["상태"] || "처리대기",
        "신청날짜": d["신청날짜"] || new Date().toLocaleString()
    };

    let deposits = [];
    if (fs.existsSync(depositPath)) {
        try {
            const content = fs.readFileSync(depositPath, 'utf8');
            deposits = content ? JSON.parse(content) : [];
        } catch (e) { deposits = []; }
    }
    
    deposits.unshift(newDeposit);

    fs.writeFile(depositPath, JSON.stringify(deposits, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("입금 신청 저장 실패:", err);
            return res.status(500).json({ success: false });
        }
        console.log(`💰 새 입금 신청 등록 완료: ${newDeposit["입금자명"]} (${newDeposit["금액"]}원)`);
        res.json({ success: true });
    });
});

// [수정 부분] 출금 신청 정보 전송 API
app.post('/api/withdraw', (req, res) => {
    const d = req.body;
    const withdrawAmount = Number(d["금액"] || 0);
    const userId = d["아이디"];

    const newWithdraw = {
        "아이디": userId || "guest",
        "닉네임": d["닉네임"] || "회원",
        "은행명": d["은행명"] || "",
        "예금주": d["예금주"] || "",
        "계좌번호": d["계좌번호"] || "",
        "금액": withdrawAmount,
        "상태": d["상태"] || "처리대기",
        "신청날짜": d["신청날짜"] || new Date().toLocaleString()
    };

    try {
        let withdraws = [];
        if (fs.existsSync(withdrawPath)) {
            const content = fs.readFileSync(withdrawPath, 'utf8');
            withdraws = content ? JSON.parse(content) : [];
        }
        withdraws.unshift(newWithdraw);
        fs.writeFileSync(withdrawPath, JSON.stringify(withdraws, null, 2), 'utf8');

        if (fs.existsSync(membersPath)) {
            let members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
            const userIndex = members.findIndex(m => m["아이디"] === userId);

            if (userIndex !== -1) {
                let currentMoney = Number(members[userIndex]["마일리지"] || 0);
                members[userIndex]["마일리지"] = currentMoney - withdrawAmount;
                fs.writeFileSync(membersPath, JSON.stringify(members, null, 2), 'utf8');
                console.log(`💸 출금 신청 완료 & 마일리지 차감: ${userId} (-${withdrawAmount}원)`);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("출금 처리 중 에러:", err);
        res.status(500).json({ success: false });
    }
});

// [신규/수정] 리뷰 목록 불러오기 API (GET) - products.json 한글 필드 매칭 로직 적용
app.get('/api/reviews', (req, res) => {
    if (!fs.existsSync(reviewsPath)) {
        return res.json([]);
    }
    try {
        const content = fs.readFileSync(reviewsPath, 'utf8');
        const reviews = content ? JSON.parse(content) : [];
        
        // 상품 정보가 있다면 매칭하여 보냄
        if (fs.existsSync(productsPath)) {
            const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
            const enrichedReviews = reviews.map(rev => {
                // 한글 필드명인 "상품코드"로 매칭
                const product = products.find(p => String(p["상품코드"]) === String(rev["상품코드"]));
                return {
                    ...rev,
                    productName: product ? product["상품명"] : (rev["상품명"] || "정보 없음"),
                    productImg: product ? product["메인사진"] : (rev["이미지"] || "")
                };
            });
            return res.json(enrichedReviews);
        }
        
        res.json(reviews);
    } catch (e) {
        console.error("리뷰 로드 에러:", e);
        res.status(500).json({ message: "리뷰 목록 로드 실패" });
    }
});

// [수정/보강] 리뷰 저장 API (POST)
app.post('/api/reviews', (req, res) => {
    const d = req.body;
    
    const newReview = {
        "상품코드": d["상품코드"] || d.productCode || "",
        "제목": d["제목"] || d.title || "",
        "내용": d["내용"] || d.content || "",
        "별점": Number(d["별점"] || d.rating || 5),
        "아이디": d["아이디"] || d.userId || "guest",
        "작성자": d["작성자"] || d.writerName || "익명",
        "승인여부": d["승인여부"] || "대기",
        "생성날짜": d["생성날짜"] || new Date().toISOString().split('T')[0]
    };

    let reviews = [];
    if (fs.existsSync(reviewsPath)) {
        try {
            const content = fs.readFileSync(reviewsPath, 'utf8');
            reviews = content ? JSON.parse(content) : [];
        } catch (e) { reviews = []; }
    }

    reviews.unshift(newReview); // 최신 리뷰가 상단에 오도록 추가

    fs.writeFile(reviewsPath, JSON.stringify(reviews, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("리뷰 저장 실패:", err);
            return res.status(500).json({ success: false, message: "서버 저장 실패" });
        }
        console.log(`⭐ 새 리뷰 등록 완료: ${newReview["아이디"]} - 상품코드: ${newReview["상품코드"]}`);
        res.json({ success: true });
    });
});

// [신규] 1:1 문의 목록 불러오기 API (GET)
app.get('/api/support-list', (req, res) => {
    if (!fs.existsSync(supportPath)) {
        return res.json([]);
    }
    try {
        const content = fs.readFileSync(supportPath, 'utf8');
        const supportList = content ? JSON.parse(content) : [];
        res.json(supportList);
    } catch (e) {
        console.error("문의 목록 로드 에러:", e);
        res.status(500).json({ message: "문의 목록 로드 실패" });
    }
});

// [신규] 1:1 문의(support) 저장 API
app.post('/api/support', (req, res) => {
    const d = req.body;
    const newSupport = {
        "아이디": d["아이디"] || "guest",
        "제목": d["제목"] || "",
        "닉네임": d["닉네임"] || "회원",
        "분류": d["분류"] || "기타",
        "이메일": d["이메일"] || "",
        "휴대폰": d["휴대폰"] || "",
        "내용": d["내용"] || "",
        "관리자답변": d["관리자답변"] || "",
        "상태": d["상태"] || "접수대기",
        "등록일": d["등록일"] || new Date().toISOString().split('T')[0]
    };

    let supportList = [];
    if (fs.existsSync(supportPath)) {
        try {
            const content = fs.readFileSync(supportPath, 'utf8');
            supportList = content ? JSON.parse(content) : [];
        } catch (e) { supportList = []; }
    }

    supportList.unshift(newSupport); // 최신 문의가 상단에 오도록 추가

    fs.writeFile(supportPath, JSON.stringify(supportList, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("문의 저장 실패:", err);
            return res.status(500).json({ success: false, message: "서버 저장 실패" });
        }
        console.log(`📩 새 문의 접수 완료: ${newSupport["아이디"]} - ${newSupport["제목"]}`);
        res.json({ success: true });
    });
});

// [기존 유지] 컬렉션 목록 조회
app.get('/list-collections', (req, res) => {
    fs.readdir(jsonDir, (err, files) => {
        if (err) {
            console.error("목록 조회 에러:", err);
            return res.status(500).send('목록 조회 실패');
        }

        let metadata = {};
        if (fs.existsSync(metaPath)) {
            try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
        }

        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'metadata.json');
        const result = jsonFiles.map(file => ({
            filename: file,
            displayName: metadata[file] || file.replace('.json', '') 
        }));
        res.json(result);
    });
});

// 서버 실행
app.listen(PORT, () => {
    console.log("---------------------------------");
    console.log(`✅ 서버 가동 성공!`);
    console.log(`🔗 홈페이지 주소: http://localhost:${PORT}/index.html`);
    console.log(`🔗 관리 도구 주소: http://localhost:${PORT}/cms_manager.html`);
});