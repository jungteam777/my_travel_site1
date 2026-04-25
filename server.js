const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // [추가] 이미지 업로드용 라이브러리
const app = express();
const PORT = 3000;

// 시작 메시지 - 서버가 켜지는지 확인용
console.log("---------------------------------");
console.log("🚀 서버 초기화 시작...");

app.use(express.json({ limit: '100mb' }));

// [핵심 수정] 정적 파일 제공 설정
// 단순히 __dirname만 쓰지 않고, 어떤 경로에서 접속하든 루트(/) 기준으로 파일을 찾게 합니다.
app.use(express.static(path.join(__dirname))); 

// [수정] 메타데이터 파일 경로를 json 폴더 내부로 지정
const jsonDir = path.join(__dirname, 'json');
const metaPath = path.join(jsonDir, 'metadata.json'); 
const membersPath = path.join(jsonDir, 'members.json'); // members.json 경로 추가

// [추가] images 폴더 없으면 생성
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// [추가] json 폴더 없으면 생성
if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
}

// [추가] 이미지 저장 설정 (multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/'); // images 폴더에 저장
    },
    filename: (req, file, cb) => {
        // 파일명: 상품코드_번호.확장자
        const ext = path.extname(file.originalname);
        const productCode = req.body.productCode || 'temp';
        const index = req.body.index || Date.now();
        cb(null, `${productCode}_${index}${ext}`);
    }
});
const upload = multer({ storage: storage });

// [추가] 이미지 업로드 API
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "파일이 없습니다." });
    
    // 저장된 파일의 경로를 클라이언트에 전달
    const imagePath = `/images/${req.file.filename}`;
    console.log(`📸 이미지 업로드 완료: ${imagePath}`);
    res.json({ success: true, path: imagePath });
});

// [추가] 회원가입 API (다른 로직 건드리지 않고 추가)
app.post('/signup', (req, res) => {
    const newMember = req.body;
    let members = [];

    // 기존 회원 정보 읽기
    if (fs.existsSync(membersPath)) {
        try {
            const content = fs.readFileSync(membersPath, 'utf8');
            members = content ? JSON.parse(content) : [];
        } catch (e) { members = []; }
    }

    // 새 회원 추가
    members.push(newMember);

    // 파일 저장
    fs.writeFile(membersPath, JSON.stringify(members, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("회원가입 저장 실패:", err);
            return res.status(500).send('저장 실패');
        }
        console.log(`👤 새 회원 등록 완료: ${newMember["아이디"]}`);
        res.send('가입 성공');
    });
});

// ---------------------------------------------------------
// [새로 추가] 로그인 API (login.html 연동)
// ---------------------------------------------------------
app.post('/login', (req, res) => {
    const { 아이디, 비밀번호 } = req.body;
    
    if (!fs.existsSync(membersPath)) {
        return res.status(400).json({ success: false, message: "회원 정보가 없습니다." });
    }

    try {
        const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
        const user = members.find(m => m["아이디"] === 아이디 && m["비밀번호"] === 비밀번호);

        if (user) {
            // 접근 차단 여부 확인
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

// ---------------------------------------------------------
// [새로 추가] 비밀번호 찾기 API (login.html 연동)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// [새로 추가] 회원 정보 수정 API (info.html 연동)
// ---------------------------------------------------------
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
            // 기존 데이터 유지하면서 넘어온 데이터로 덮어쓰기
            // 만약 비밀번호가 비어있다면 기존 비밀번호 유지
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

// 데이터 저장 API (기존 로직 유지 + 한글명 저장 추가)
app.post('/save-json', (req, res) => {
    const { filename, data, displayName } = req.body; // displayName 추가 수신
    let pureFilename = filename.replace('.csv', '.json');
    if (!pureFilename.endsWith('.json')) pureFilename += '.json';
    const filePath = path.join(jsonDir, pureFilename);

    // 무조건 현재 화면에 보이는 data로 파일을 새로 만듭니다.
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("저장 실패:", err);
            return res.status(500).send('저장 실패');
        }

        // [한글 이름 저장 로직 추가]
        if (displayName) {
            let metadata = {};
            if (fs.existsSync(metaPath)) {
                try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
            }
            metadata[pureFilename] = displayName;
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
        }

        console.log(`✅ ${pureFilename} 저장 완료! (중복 없이 ${data.length}개)`);
        res.send('저장 성공!');
    });
});

// 수정: json 폴더 내의 파일 목록을 읽을 때 한글 이름을 매칭해서 전달
app.get('/list-collections', (req, res) => {
    fs.readdir(jsonDir, (err, files) => {
        if (err) {
            console.error("목록 조회 에러:", err);
            return res.status(500).send('목록 조회 실패');
        }

        // metadata.json 읽기
        let metadata = {};
        if (fs.existsSync(metaPath)) {
            try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
        }

        // .json 파일만 골라내고 한글 이름 매핑
        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'metadata.json');
        const result = jsonFiles.map(file => ({
            filename: file,
            displayName: metadata[file] || file.replace('.json', '') // 매핑 없으면 파일명 사용
        }));

        res.json(result);
    });
});


// 서버 실행
app.listen(PORT, () => {
    console.log("---------------------------------");
    console.log(`✅ 서버 가동 성공!`);
    console.log(`🔗 접속 주소: http://localhost:${PORT}/cms_manager.html`);
    console.log(`🔗 접속 주소: http://localhost:${PORT}/index.html`);
});