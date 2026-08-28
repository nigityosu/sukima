const bookFormats = { '雑誌': 10, '新書': 12, 'コミック': 14, '文庫': 15, '単行本': 20 };
let currentTab = 'basic';
let scannedBooks = []; // 蔵書スキャン用の配列

// 初期化
window.onload = () => {
    const checkboxContainer = document.getElementById('format-checkboxes');
    for (const [format, size] of Object.entries(bookFormats)) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `<input type="checkbox" value="${format}" checked> ${format}(約${size}mm)`;
        checkboxContainer.appendChild(label);
    }
};

// タブ切り替え
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
}

// ARメジャー機能 (Mock)
function simulateARMeasure() {
    alert("カメラを起動しています... (シミュレーション)");
    const randomGap = Math.floor(Math.random() * 50) + 30; // 30〜80mmのランダム
    document.getElementById('gap-size').value = randomGap;
    alert(`本棚の隙間を認識しました: ${randomGap}mm`);
}

// 蔵書スキャン機能 (Mock)
const mockBooks = [
    { title: "積読のビジネス書", size: 18 },
    { title: "読みかけのミステリー", size: 15 },
    { title: "昔買った新書", size: 12 },
    { title: "分厚い技術書", size: 30 }
];
function simulateBarcodeScan() {
    alert("バーコードを読み取っています... (シミュレーション)");
    const book = mockBooks[Math.floor(Math.random() * mockBooks.length)];
    scannedBooks.push({ name: book.title, size: book.size });
    updateScannedList();
}
function updateScannedList() {
    const list = document.getElementById('scanned-books-list');
    list.innerHTML = '';
    scannedBooks.forEach(b => {
        list.innerHTML += `<li>${b.name} (厚さ: ${b.size}mm)</li>`;
    });
}

// メイン計算処理
async function calculateCombinations() {
    const gapSize = parseInt(document.getElementById('gap-size').value, 10);
    const resultArea = document.getElementById('result-area');
    const wireframeArea = document.getElementById('wireframe-area');
    const loading = document.getElementById('loading');
    
    if (isNaN(gapSize) || gapSize <= 0) return alert("正しい隙間の数値を入力してください。");

    resultArea.innerHTML = '';
    wireframeArea.style.display = 'none';
    let items = [];
    let allowDuplicates = true; // 基本とAPIは同じ本を複数買えるとする。蔵書は1回のみ。

    // モードごとのデータ準備
    if (currentTab === 'basic') {
        const selectedFormats = Array.from(document.querySelectorAll('#format-checkboxes input:checked')).map(cb => cb.value);
        if (selectedFormats.length === 0) return alert("本の種類を選択してください。");
        items = selectedFormats.map(f => ({ name: f, size: bookFormats[f] }));
    } 
    else if (currentTab === 'scan') {
        if (scannedBooks.length === 0) return alert("本をスキャンしてください。");
        items = [...scannedBooks];
        allowDuplicates = false; // 蔵書は1冊ずつ
    } 
    else if (currentTab === 'api') {
        loading.style.display = 'block';
        const theme = document.getElementById('api-theme').value;
        try {
            // Google Books APIからデータ取得
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(theme)}&maxResults=15`);
            const data = await res.json();
            items = data.items.map(item => {
                const title = item.volumeInfo.title.substring(0, 20); // 長すぎるのでカット
                const pages = item.volumeInfo.pageCount || Math.floor(Math.random() * 200 + 100);
                // ページ数から厚さを推算（ページあたり0.05mm + 表紙2mm）
                const thickness = Math.floor(pages * 0.05 + 2);
                return { name: `『${title}』`, size: thickness };
            });
        } catch (e) {
            alert("API通信に失敗しました。");
            loading.style.display = 'none';
            return;
        }
        loading.style.display = 'none';
    }

    // ナップサック問題/部分和問題アルゴリズム (DFS)
    let results = [];
    const tolerance = 2; // 隙間マイナス2mmまで許容

    function dfs(index, currentSum, currentCombo) {
        if (currentSum > gapSize) return;
        if (gapSize - currentSum <= tolerance) {
            // 組み合わせ文字列を作成して重複チェック
            const comboNames = currentCombo.map(i => i.name).sort().join(',');
            if (!results.some(r => r.str === comboNames)) {
                results.push({ str: comboNames, combo: [...currentCombo], total: currentSum });
            }
            return;
        }
        if (results.length >= 10) return; // 10パターンで打ち切り

        for (let i = index; i < items.length; i++) {
            currentCombo.push(items[i]);
            // 蔵書(重複不可)の場合は次のインデックスへ、そうでない場合は同じ本も選べる
            dfs(allowDuplicates ? i : i + 1, currentSum + items[i].size, currentCombo);
            currentCombo.pop();
        }
    }

    dfs(0, 0, []);

    if (results.length === 0) {
        resultArea.innerHTML = '<p>ぴったり収まる組み合わせが見つかりませんでした。</p>';
        return;
    }

    // 結果表示
    resultArea.innerHTML = '<h3>おすすめの組み合わせ</h3>';
    results.forEach((result, idx) => {
        const counts = {};
        result.combo.forEach(book => {
            counts[book.name] = (counts[book.name] || 0) + 1;
        });
        
        // 本の視覚的な表示
        let bookBoxesHtml = '<div class="book-boxes-container">';
        const maxSize = Math.max(...result.combo.map(b => b.size));
        result.combo.forEach(b => {
            const heightPercent = (b.size / maxSize) * 100;
            bookBoxesHtml += `<div class="book-box" style="height: ${heightPercent}%; min-width: ${Math.max(20, b.size * 0.8)}px;" title="${b.name} (${b.size}mm)"></div>`;
        });
        bookBoxesHtml += '</div>';

        let detailsHtml = '';
        if (currentTab === 'basic') {
            detailsHtml = '<div class="result-details">' + Object.keys(counts).map(k => `${k} ${counts[k]}冊`).join(' ＋ ') + '</div>';
        } else {
            detailsHtml = '<div class="result-book-list">';
            result.combo.forEach(b => {
                detailsHtml += `<span class="result-book-badge">${b.name} (${b.size}mm)</span>`;
            });
            detailsHtml += '</div>';
        }

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="result-title">パターン ${idx + 1}</div>
            <div class="result-info">全${result.combo.length}冊 / 合計: ${result.total}mm / 残り: ${gapSize - result.total}mm</div>
            ${bookBoxesHtml}
            ${detailsHtml}
            <button class="btn-secondary" style="margin-top:10px;" onclick='drawWireframe(${JSON.stringify(result.combo)}, ${gapSize})'>この組み合わせのイメージ図を見る</button>
        `;
        resultArea.appendChild(card);
    });
}

// 画像認識イメージ図 (Canvasによるワイヤーフレーム描画)
function drawWireframe(combo, maxGap) {
    const area = document.getElementById('wireframe-area');
    area.style.display = 'block';
    const canvas = document.getElementById('bookshelf-canvas');
    const ctx = canvas.getContext('2d');
    
    // クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // スケール計算 (キャンバスの幅に対して隙間サイズをマッピング)
    const scale = (canvas.width - 40) / maxGap; 
    let currentX = 20; // 左右の余白
    const startY = 30;
    const height = 140;

    // 本棚の枠線（上下）を描画
    ctx.strokeStyle = "#5c4330";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, startY - 2);
    ctx.lineTo(canvas.width - 10, startY - 2);
    ctx.moveTo(10, startY + height + 2);
    ctx.lineTo(canvas.width - 10, startY + height + 2);
    ctx.stroke();

    // 本を一つずつ描画
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";
    ctx.fillStyle = "#fff";
    
    combo.forEach(book => {
        const bookWidth = book.size * scale;
        // 本の枠
        ctx.fillRect(currentX, startY, bookWidth, height);
        ctx.strokeRect(currentX, startY, bookWidth, height);
        
        // 本のタイトル（縦書き風に配置）
        ctx.fillStyle = "#333";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        
        // テキストが枠より大きい場合は省略
        const displayName = book.name.replace(/『|』/g, '').substring(0, 8);
        ctx.save();
        ctx.translate(currentX + bookWidth / 2, startY + 20);
        ctx.rotate(Math.PI / 2); // 90度回転
        ctx.fillText(displayName, 0, 4);
        ctx.restore();
        
        currentX += bookWidth;
    });

    // 残りの隙間を斜線で表現
    const remainingWidth = (maxGap * scale) - (currentX - 20);
    if (remainingWidth > 2) {
        ctx.fillStyle = "rgba(200, 0, 0, 0.2)";
        ctx.fillRect(currentX, startY, remainingWidth, height);
        ctx.fillStyle = "#d2691e";
        ctx.font = "10px sans-serif";
        ctx.fillText(`隙間`, currentX + remainingWidth/2, startY + height/2);
    }
}
