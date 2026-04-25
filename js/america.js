document.addEventListener("DOMContentLoaded", () => {
    loadUsaProducts();
});

async function loadUsaProducts() {
    try {
        // 1. JSON 데이터 불러오기
        const response = await fetch('products.json');
        const allItems = await response.json();

        // 2. 카테고리가 "미국여행"인 상품만 필터링
        const usaItems = allItems.filter(item => item["카테고리"] === "미국여행");

        const listBody = document.getElementById('listBody');
        if (!listBody) return;

        if (usaItems.length === 0) {
            listBody.innerHTML = '<p style="text-align:center; padding:100px; color:#999;">등록된 미국여행 상품이 없습니다.</p>';
            return;
        }

        // 3. 필터링된 데이터로 HTML 생성
        let html = '';
        usaItems.forEach(item => {
            // 가격 처리 (숫자 포맷팅)
            const price = item["성인요금"] ? Number(item["성인요금"]).toLocaleString() : "가격문의";
            
            // 이미지 처리 (데이터 없을 때 대체 이미지)
            const imgUrl = item["메인사진"] || 'https://via.placeholder.com/300x180?text=No+Image';

            html += `
                <div class="product-card">
                    <img src="${imgUrl}" alt="${item["상품명"]}" class="product-img">
                    <div class="product-info">
                        <div class="product-title">${item["상품명"]}</div>
                        <div class="product-price">${price}<span class="price-unit">원~</span></div>
                        <div class="product-tags">${item["기본설명"] || ''}</div>
                        <button class="detail-btn" onclick="window.parent.postMessage({type:'detail', id:'${item["상품코드"]}'}, '*')">상세보기</button>
                    </div>
                </div>
            `;
        });

        // 4. 화면에 뿌리기
        listBody.innerHTML = html;

    } catch (error) {
        console.error("데이터 로드 중 에러 발생:", error);
        document.getElementById('listBody').innerHTML = '<p style="text-align:center; padding:100px;">데이터를 불러오는 데 실패했습니다.</p>';
    }
}