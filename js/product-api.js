/**
 * 하누리 여행사 - 상품 관리 API (이미지 업로드 및 JSON 저장 통합본)
 */
const ProductAPI = {
    // [확인 완료] 형님이 말씀하신 진짜 파일명: products.json
    FILENAME: 'products.json',

    // 1. 이미지 서버 업로드 함수
    uploadImage: async function(file, productCode, index) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('productCode', productCode);
        formData.append('index', index);

        try {
            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error("이미지 업로드 API 오류:", error);
            return { success: false, message: "이미지 서버 전송 실패" };
        }
    },

    // 2. 상품 정보 최종 저장 함수
    saveProduct: async function(newProduct) {
        try {
            // (1) 기존 데이터를 불러옵니다 (products.json)
            let currentData = [];
            try {
                const response = await fetch(`/json/${this.FILENAME}?t=${new Date().getTime()}`);
                if (response.ok) {
                    currentData = await response.json();
                }
            } catch (e) {
                console.log("기존 파일이 없거나 첫 저장입니다.");
            }

            // (2) 데이터 업데이트 (형님이 정하신 한글 제목 '상품코드' 기준)
            const index = currentData.findIndex(p => p["상품코드"] === newProduct["상품코드"]);
            
            if (index > -1) {
                currentData[index] = newProduct;
            } else {
                currentData.push(newProduct);
            }

            // (3) 서버의 '/save-json' API로 전송
            const saveResponse = await fetch('/save-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: this.FILENAME, // products.json 전송
                    data: currentData 
                })
            });

            if (saveResponse.ok) {
                return { success: true, message: `서버의 ${this.FILENAME}에 저장되었습니다!` };
            } else {
                throw new Error("서버 저장 실패");
            }

        } catch (error) {
            console.error("API 오류:", error);
            return { success: false, message: "저장 중 오류가 발생했습니다: " + error.message };
        }
    }
};