const bookFormats = { '雑誌': 10, '新書': 12, 'コミック': 14, '文庫': 15, '単行本': 20 };
let currentTab = 'basic';
let scannedBooks = []; // 蔵書スキャン用の配列
let cameraStream = null;
const MAX_CUSTOM_BOOKS = 3;

const mockBookApiData = {
    'SF小説': [
        { type: '文庫', pages: 320 },
        { type: '新書', pages: 280 },
        { type: '単行本', pages: 240 },
        { type: 'コミック', pages: 360 }
    ],
    'ミステリー小説': [
        { type: '文庫', pages: 310 },
        { type: '新書', pages: 260 },
        { type: '単行本', pages: 340 },
        { type: '雑誌', pages: 290 }
    ],
    'ビジネス書': [
        { type: '新書', pages: 220 },
        { type: '文庫', pages: 250 },
        { type: '単行本', pages: 210 },
        { type: 'コミック', pages: 270 }
    ],
    'プログラミング': [
        { type: '単行本', pages: 420 },
        { type: '文庫', pages: 390 },
        { type: '新書', pages: 260 },
        { type: '雑誌', pages: 330 }
    ],
    '料理': [
        { type: '新書', pages: 180 },
        { type: '文庫', pages: 220 },
        { type: '単行本', pages: 150 },
        { type: '雑誌', pages: 200 }
    ]
};

// 初期化
window.onload = () => {
    const checkboxContainer = document.getElementById('format-checkboxes');
    for (const [format, size] of Object.entries(bookFormats)) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `<input type="checkbox" value="${format}" checked> ${format}(約${size}mm)`;
        checkboxContainer.appendChild(label);
    }

    document.getElementById('camera-button').addEventListener('click', openCamera);
    document.getElementById('capture-gap-btn').addEventListener('click', captureGapFromCamera);
    document.getElementById('close-camera-btn').addEventListener('click', closeCamera);
    document.getElementById('add-custom-book-btn').addEventListener('click', addCustomBook);
};

// タブ切り替え
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const activeTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (activeTab) activeTab.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
}

function openCamera() {
    const wrapper = document.getElementById('camera-wrapper');
    const video = document.getElementById('camera-video');
    wrapper.classList.remove('hidden');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('この環境ではカメラが使えません。代わりに手入力で隙間を設定してください。');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(stream => {
            cameraStream = stream;
            video.srcObject = stream;
            video.play();
        })
        .catch(() => {
            alert('カメラの起動に失敗しました。手動入力に切り替えてください。');
            closeCamera();
        });
}

function closeCamera() {
    const wrapper = document.getElementById('camera-wrapper');
    const video = document.getElementById('camera-video');
    wrapper.classList.add('hidden');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (video) {
        video.srcObject = null;
    }
}

function captureGapFromCamera() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    if (!video || !video.videoWidth || !video.videoHeight) {
        alert('カメラの起動がまだ完了していません。');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightnessSum = 0;
    let pixelCount = 0;

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const brightness = (r + g + b) / 3;
        brightnessSum += brightness;
        pixelCount += 1;
    }

    const avgBrightness = brightnessSum / pixelCount;
    const estimatedGap = Math.max(25, Math.min(150, Math.round((255 - avgBrightness) * 0.9 + 20)));
    document.getElementById('gap-size').value = estimatedGap;
    alert(`カメラで本棚の隙間を認識しました: ${estimatedGap}mm`);
    closeCamera();
}

function getMockBookApi(theme) {
    const books = mockBookApiData[theme] || mockBookApiData['SF小説'];
    return books.map((book) => {
        const thickness = Math.max(12, Math.round((book.pages || 220) * 0.05 + 2));
        return { name: `${book.type} (${thickness}mm)`, size: thickness };
    });
}

async function fetchLocalBooks(theme) {
    try {
        const response = await fetch(`./api/books.json?theme=${encodeURIComponent(theme)}`);
        if (!response.ok) throw new Error('local api error');
        const data = await response.json();
        const items = (data[theme] || data.books || []).map((book) => ({
            name: `${book.type || '本'} (${Math.max(12, Math.round((book.pages || 220) * 0.05 + 2))}mm)`,
            size: Math.max(12, Math.round((book.pages || 220) * 0.05 + 2))
        }));

        if (items.length > 0) return items;
        throw new Error('no local data');
    } catch (error) {
        return null;
    }
}

async function fetchBooksFromApi(theme) {
    const apiStatus = document.getElementById('api-status');
    const localItems = await fetchLocalBooks(theme);
    if (localItems && localItems.length > 0) {
        apiStatus.textContent = '※ローカルAPIから本を取得しました。';
        return localItems;
    }

    const apiUrl = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(theme) + '&maxResults=5';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('APIエラー');
        }
        const data = await response.json();
        const items = (data.items || []).map((item) => {
            const pages = item.volumeInfo?.pageCount || 220;
            const thickness = Math.max(12, Math.round(pages * 0.05 + 2));
            const type = ['雑誌', '新書', 'コミック', '文庫', '単行本'][Math.floor(Math.random() * 5)];
            return {
                name: `${type} (${thickness}mm)`,
                size: thickness
            };
        });

        if (items.length > 0) {
            apiStatus.textContent = '※Google Books APIから本を取得しました。';
            return items;
        }
        throw new Error('データなし');
    } catch (error) {
        const fallback = getMockBookApi(theme);
        apiStatus.textContent = '※APIは未接続のため、ローカルのモックデータを利用しています。';
        return fallback;
    }
}

// 蔵書スキャン機能 (Mock)
const mockBooks = [
    { title: "積読のビジネス書", size: 18 },
    { title: "読みかけのミステリー", size: 15 },
    { title: "昔買った新書", size: 12 },
    { title: "分厚い技術書", size: 30 }
];
function addCustomBook() {
    const type = document.getElementById('custom-book-type').value;
    const sizeInput = document.getElementById('custom-book-size');
    const size = parseInt(sizeInput.value, 10);

    if (scannedBooks.length >= MAX_CUSTOM_BOOKS) {
        alert(`持っている本は最大${MAX_CUSTOM_BOOKS}冊までです。`);
        return;
    }

    if (isNaN(size) || size <= 0) {
        alert('本の厚さは1以上の数値を入力してください。');
        return;
    }

    scannedBooks.push({ name: `${type} (${size}mm)`, size });
    sizeInput.value = '';
    updateScannedList();
}

function removeCustomBook(index) {
    scannedBooks.splice(index, 1);
    updateScannedList();
}

function simulateBarcodeScan() {
    if (scannedBooks.length >= MAX_CUSTOM_BOOKS) {
        alert(`持っている本は最大${MAX_CUSTOM_BOOKS}冊までです。`);
        return;
    }

    alert("バーコードを読み取っています... (シミュレーション)");
    const book = mockBooks[Math.floor(Math.random() * mockBooks.length)];
    scannedBooks.push({ name: `${book.title} (${book.size}mm)`, size: book.size });
    updateScannedList();
}
function updateScannedList() {
    const list = document.getElementById('scanned-books-list');
    list.innerHTML = '';
    scannedBooks.forEach((b, index) => {
        const item = document.createElement('li');
        item.innerHTML = `<span>${b.name}</span><button type="button" data-index="${index}">削除</button>`;
        item.querySelector('button').addEventListener('click', () => removeCustomBook(index));
        list.appendChild(item);
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
        items = await fetchBooksFromApi(theme);
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
