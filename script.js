let currentUnit = 'mm';
let allSheetsResults = []; // 儲存所有木板的計算結果
let lastTotalPerimeter = 0; // 儲存當前計算出的總周長

// 頁面載入時預設帶入一列空白輸入框
window.onload = () => {
    addItemRow('', '', '');
    updatePerimeterDisplay();
};

// 動態新增切片項目（無預設值）
function addItemRow(w = '', h = '', count = '') {
    const container = document.getElementById('itemList');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
    <input type="number" class="item-w" placeholder="長" value="${w}" step="any">
    <span>×</span>
    <input type="number" class="item-h" placeholder="寬" value="${h}" step="any">
    <input type="number" class="item-count" placeholder="數量" value="${count}" min="1">
    <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

// 單位自動轉換（mm <-> cm）
function handleUnitChange(newUnit) {
    if (newUnit === currentUnit) return;

    const factor = newUnit === 'cm' ? 0.1: 10;

    // 轉換底板與鋸縫
    ['boardW', 'boardH', 'gap'].forEach(id => {
        const input = document.getElementById(id);
        if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    // 轉換切片尺寸
    document.querySelectorAll('.item-w, .item-h').forEach(input => {
        if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    // 轉換周長紀錄
    if (lastTotalPerimeter > 0) {
        lastTotalPerimeter = lastTotalPerimeter * factor;
    }

    currentUnit = newUnit;
    updatePerimeterDisplay();
}

// 更新總周長文字顯示
function updatePerimeterDisplay() {
    const formattedPerimeter = lastTotalPerimeter.toFixed(1).replace(/\.0$/, '');
    document.getElementById('statPerimeter').innerText = `${formattedPerimeter} ${currentUnit}`;
}

// 多板裝箱演算法 (Bin Packing Multiple Sheets)
function calculateLayout() {
    const boardW = parseFloat(document.getElementById('boardW').value);
    const boardH = parseFloat(document.getElementById('boardH').value);
    const gap = parseFloat(document.getElementById('gap').value) || 0;
    const allowRotation = document.getElementById('allowRotation').checked;

    if (!boardW || !boardH) {
        alert('請輸入有效的底板尺寸');
        return;
    }

    // 收集所有需要切割的獨立區塊
    let unplacedItems = [];
    const rows = document.querySelectorAll('.item-row');

    rows.forEach((row, idx) => {
        const w = parseFloat(row.querySelector('.item-w').value);
        const h = parseFloat(row.querySelector('.item-h').value);
        const count = parseInt(row.querySelector('.item-count').value) || 0;

        if (w > 0 && h > 0 && count > 0) {
            const fitsNormal = w <= boardW && h <= boardH;
            const fitsRotated = allowRotation && (h <= boardW && w <= boardH);

            if (!fitsNormal && !fitsRotated) {
                alert(`警告：第 ${idx+1} 組尺寸 ${w} × ${h} 超出底板尺寸 (${boardW} × ${boardH})，無法放入！`);
            }

            for (let i = 0; i < count; i++) {
                unplacedItems.push({
                    id: `組${idx+1}-${i+1}`, w, h, area: w * h
                });
            }
        }
    });

    if (unplacedItems.length === 0) {
        alert('請輸入至少一組有效的切片長、寬與數量！');
        return;
    }

    // 優先放入較大面積的木板 (Greedy Order)
    unplacedItems.sort((a, b) => b.area - a.area);

    allSheetsResults = [];
    let totalPlacedAreaAllSheets = 0;
    let calculatedTotalPerimeter = 0; // 累加所有排入木板的總周長

    // 迴圈：只要還有未放入的木板，就開啟新的一張底板，直到全數排完為止
    while (unplacedItems.length > 0) {
        let freeRects = [{
            x: 0, y: 0, w: boardW, h: boardH
        }];
        let placedInThisSheet = [];
        let remainingItemsForNextSheet = [];
        let sheetPlacedArea = 0;

        for (let item of unplacedItems) {
            let bestFit = null;
            let bestRotated = false;

            // 尋找當前底板中的最佳剩餘空間
            for (let i = 0; i < freeRects.length; i++) {
                let rect = freeRects[i];

                // 1. 不旋轉測試
                if (item.w <= rect.w && item.h <= rect.h) {
                    bestFit = {
                        rectIdx: i, x: rect.x, y: rect.y, w: item.w, h: item.h
                    };
                    bestRotated = false;
                    break;
                }
                // 2. 允許旋轉 90 度測試
                if (allowRotation && item.h <= rect.w && item.w <= rect.h) {
                    bestFit = {
                        rectIdx: i, x: rect.x, y: rect.y, w: item.h, h: item.w
                    };
                    bestRotated = true;
                    break;
                }
            }

            if (bestFit) {
                // 成功放入當前底板
                placedInThisSheet.push({
                    x: bestFit.x, y: bestFit.y,
                    w: bestFit.w, h: bestFit.h,
                    origW: item.w, origH: item.h,
                    rotated: bestRotated
                });
                sheetPlacedArea += item.area;

                // 計算並累加單塊木板周長: 2 * (長 + 寬)
                calculatedTotalPerimeter += 2 * (item.w + item.h);

                // 切割剩餘可利用空間
                let usedRect = freeRects.splice(bestFit.rectIdx, 1)[0];

                // 切割右側空間
                if (usedRect.w - bestFit.w - gap > 0) {
                    freeRects.push({
                        x: bestFit.x + bestFit.w + gap,
                        y: bestFit.y,
                        w: usedRect.w - bestFit.w - gap,
                        h: bestFit.h
                    });
                }
                // 切割下側空間
                if (usedRect.h - bestFit.h - gap > 0) {
                    freeRects.push({
                        x: bestFit.x,
                        y: bestFit.y + bestFit.h + gap,
                        w: usedRect.w,
                        h: usedRect.h - bestFit.h - gap
                    });
                }
            } else {
                // 當前底板塞不下，留給下一張底板
                remainingItemsForNextSheet.push(item);
            }
        }

        // 防呆機制：如果一張板子連一個都放不進去，說明該物件超出尺寸限制，終止迴圈
        if (placedInThisSheet.length === 0) {
            console.warn('部分物件過大無法排入任何板材。');
            break;
        }

        totalPlacedAreaAllSheets += sheetPlacedArea;
        allSheetsResults.push({
            placedItems: placedInThisSheet,
            usage: ((sheetPlacedArea / (boardW * boardH)) * 100).toFixed(1)
        });

        unplacedItems = remainingItemsForNextSheet;
    }

    // 計算全域統計資訊
    const totalBoardsArea = allSheetsResults.length * (boardW * boardH);
    const avgUsage = totalBoardsArea > 0 ? ((totalPlacedAreaAllSheets / totalBoardsArea) * 100).toFixed(1): 0;

    lastTotalPerimeter = calculatedTotalPerimeter;

    document.getElementById('statUsage').innerText = `${avgUsage}%`;
    document.getElementById('statSheets').innerText = allSheetsResults.length;
    updatePerimeterDisplay();

    // 渲染頁籤與第一張底板的 Canvas
    renderTabs(boardW, boardH);
    if (allSheetsResults.length > 0) {
        switchSheet(0, boardW, boardH);
    }
}

// 渲染底板分頁按鈕 (Tabs)
function renderTabs(boardW, boardH) {
    const tabsContainer = document.getElementById('sheetTabs');
    tabsContainer.innerHTML = '';

    allSheetsResults.forEach((sheet, idx) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${idx === 0 ? 'active': ''}`;
        btn.innerText = `底板 #${idx + 1} (${sheet.usage}%)`;
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchSheet(idx, boardW, boardH);
        };
        tabsContainer.appendChild(btn);
    });
}

// 切換顯示特定一張底板
function switchSheet(index, boardW, boardH) {
    const sheet = allSheetsResults[index];
    if (sheet) {
        renderCanvas(boardW, boardH, sheet.placedItems);
    }
}

// 畫出 Canvas 木板佈局
function renderCanvas(boardW, boardH, placedItems) {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 依容器寬度動態縮放 Canvas
    const maxCanvasWidth = Math.min(container.clientWidth - 30, 700);
    const scale = maxCanvasWidth / boardW;

    canvas.width = boardW * scale;
    canvas.height = boardH * scale;
    container.appendChild(canvas);

    // 1. 繪製底板背景與邊框
    ctx.fillStyle = '#e8d8c3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // 2. 繪製切割好的木片
    const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9c27b0', '#009688', '#3f51b5'];

    placedItems.forEach((item, i) => {
        const x = item.x * scale;
        const y = item.y * scale;
        const w = item.w * scale;
        const h = item.h * scale;

        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, w, h);

        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        // 標記尺寸文字 (當區塊足夠大時才繪製)
        if (w > 25 && h > 15) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.max(10, Math.min(13, w / 5))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = `${item.origW}×${item.origH}${item.rotated ? ' ↻': ''}`;
            ctx.fillText(label, x + w / 2, y + h / 2);
        }
    });
}
