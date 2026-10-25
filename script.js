let currentUnit = 'mm';
let allSheetsResults = [];
let lastTotalPerimeter = 0;

let parsedExcelData = [];
let excelHeaders = [];

window.onload = () => {
    addItemRow('', '', '', false);
    updatePerimeterDisplay();
};

function closeNoticeModal() {
    document.getElementById('noticeModal').style.display = 'none';
}

/**
* 負數與數值校正功能優化
* type:
*   - 'zeroAllowed': 鋸縫/間隔 (gap)、數量 (count) -> 負數校正為 0
*   - 'dimension': 尺寸 (長, 寬) -> 負數或 0 校正為 1
*/
function validatePositiveInput(input, type = 'dimension') {
    if (input.value === '') return;

    const val = parseFloat(input.value);
    if (type === 'zeroAllowed') {
        if (isNaN(val) || val < 0) {
            input.value = 0;
        }
    } else {
        // dimension
        if (isNaN(val) || val <= 0) {
            input.value = 1;
        }
    }
}

function clearInvalidMark(element) {
    if (element) {
        element.classList.remove('is-invalid');
    }
}

function clearAllItems() {
    if (confirm('確定要清除所有切片需求項目嗎？')) {
        const container = document.getElementById('itemList');
        container.innerHTML = '';
        addItemRow('', '', '', false);
    }
}

function addItemRow(w = '', h = '', count = '', focusFirst = false) {
    const container = document.getElementById('itemList');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
    <input type="number" class="form-control item-w" placeholder="長" value="${w}" min="1" step="any" onchange="validatePositiveInput(this, 'dimension'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <span>×</span>
    <input type="number" class="form-control item-h" placeholder="寬" value="${h}" min="1" step="any" onchange="validatePositiveInput(this, 'dimension'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <input type="number" class="form-control item-count" placeholder="數量" value="${count}" min="0" step="1" onchange="validatePositiveInput(this, 'zeroAllowed'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <button class="btn-delete" title="刪除此列" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;

    if (focusFirst) {
        const inputW = div.querySelector('.item-w');
        if (inputW) inputW.focus();
    }
}

function handleKeyNavigation(event, currentInput) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const type = currentInput.classList.contains('item-count') ? 'zeroAllowed': 'dimension';
        validatePositiveInput(currentInput, type);

        const row = currentInput.closest('.item-row');
        const rowInputs = Array.from(row.querySelectorAll('input[type="number"]'));
        const currentIndex = rowInputs.indexOf(currentInput);

        if (currentIndex < rowInputs.length - 1) {
            rowInputs[currentIndex + 1].focus();
            rowInputs[currentIndex + 1].select();
        } else {
            const allRows = Array.from(document.querySelectorAll('.item-row'));
            const currentRowIndex = allRows.indexOf(row);

            if (currentRowIndex === allRows.length - 1) {
                addItemRow('', '', '', true);
            } else {
                const nextRowFirstInput = allRows[currentRowIndex + 1].querySelector('.item-w');
                if (nextRowFirstInput) {
                    nextRowFirstInput.focus();
                    nextRowFirstInput.select();
                }
            }
        }
    }
}

function handleUnitChange(newUnit) {
    if (!newUnit || newUnit === currentUnit) return;

    const factor = newUnit === 'cm' ? 0.1: 10;

    ['boardW', 'boardH', 'gap'].forEach(id => {
        const input = document.getElementById(id);
        if (input && input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    document.querySelectorAll('.item-w, .item-h').forEach(input => {
        if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    if (lastTotalPerimeter > 0) {
        lastTotalPerimeter = lastTotalPerimeter * factor;
    }

    currentUnit = newUnit;
    updatePerimeterDisplay();
}

function updatePerimeterDisplay() {
    const formattedPerimeter = lastTotalPerimeter.toFixed(1).replace(/\.0$/, '');
    const unitText = currentUnit ? currentUnit: 'mm';
    document.getElementById('statPerimeter').innerText = `${formattedPerimeter} ${unitText}`;
}

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {
                type: 'array'
            });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1
            });

            // 確保檔案至少有 6 行以上（第 6 行作為標題）
            if (jsonData.length < 6) {
                alert('Excel 檔案內的資料不足 6 行，無法從第 6 行開始讀取！');
                return;
            }

            // 調整：第 6 橫排 (index 5) 作為欄位標題，之後的橫排作為資料
            excelHeaders = jsonData[5].map(h => String(h).trim());
            parsedExcelData = jsonData.slice(6);

            openExcelModal();
        } catch (err) {
            alert('解析 Excel 檔案失敗，請確認檔案格式是否正確。');
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);

    event.target.value = '';
}

function openExcelModal() {
    const modal = document.getElementById('excelModal');
    const selectW = document.getElementById('colSelectW');
    const selectH = document.getElementById('colSelectH');
    const selectCount = document.getElementById('colSelectCount');

    [selectW, selectH, selectCount].forEach(sel => sel.innerHTML = '');

    excelHeaders.forEach((header, idx) => {
        const optW = new Option(`${header} (欄 ${idx+1})`, idx);
        const optH = new Option(`${header} (欄 ${idx+1})`, idx);
        const optCount = new Option(`${header} (欄 ${idx+1})`, idx);

        selectW.add(optW);
        selectH.add(optH);
        selectCount.add(optCount);
    });

    excelHeaders.forEach((h, idx) => {
        const headerLower = h.toLowerCase();
        if (headerLower.includes('長') || headerLower.includes('length') || headerLower.includes('w')) selectW.value = idx;
        if (headerLower.includes('寬') || headerLower.includes('width') || headerLower.includes('h')) selectH.value = idx;
        if (headerLower.includes('數') || headerLower.includes('量') || headerLower.includes('count') || headerLower.includes('qty')) selectCount.value = idx;
    });

    if (selectW.value === selectH.value && excelHeaders.length > 1) {
        selectH.value = 1;
    }

    renderExcelPreviewTable();

    modal.style.display = 'flex';
}

function closeExcelModal() {
    document.getElementById('excelModal').style.display = 'none';
}

function renderExcelPreviewTable() {
    const container = document.getElementById('excelPreviewTableContainer');
    let html = '<table class="preview-table"><thead><tr>';

    excelHeaders.forEach(h => {
        html += `<th>${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    // 往下預覽 5 橫排資料
    const previewRows = parsedExcelData.slice(0, 5);
    previewRows.forEach(row => {
        html += '<tr>';
        excelHeaders.forEach((_, colIdx) => {
            const val = row[colIdx] !== undefined ? row[colIdx]: '';
            html += `<td>${val}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function confirmExcelImport() {
    const colWIdx = parseInt(document.getElementById('colSelectW').value);
    const colHIdx = parseInt(document.getElementById('colSelectH').value);
    const colCountIdx = parseInt(document.getElementById('colSelectCount').value);
    const importMode = document.querySelector('input[name="importMode"]:checked').value;

    const itemListContainer = document.getElementById('itemList');

    if (importMode === 'replace') {
        itemListContainer.innerHTML = '';
    }

    let importedRowsCount = 0;

    parsedExcelData.forEach(row => {
        const rawW = parseFloat(row[colWIdx]);
        const rawH = parseFloat(row[colHIdx]);
        let rawCount = parseInt(row[colCountIdx]);

        if (isNaN(rawCount) || rawCount < 1) {
            rawCount = 1;
        }

        if (!isNaN(rawW) && !isNaN(rawH) && rawW > 0 && rawH > 0) {
            addItemRow(rawW, rawH, rawCount);
            importedRowsCount++;
        }
    });

    if (importedRowsCount === 0) {
        alert('未能匯入任何有效數字資料，請確認選取的長寬欄位是否包含數字。');
    } else {
        alert(`成功匯入 ${importedRowsCount} 筆切片尺寸數據！`);
        closeExcelModal();
    }
}

function isOverlapping(placedItems, freeRect, newW, newH) {
    const rectToCheck = {
        x: freeRect.x,
        y: freeRect.y,
        w: newW,
        h: newH
    };
    for (const placed of placedItems) {
        if (
            rectToCheck.x < placed.x + placed.w &&
            rectToCheck.x + rectToCheck.w > placed.x &&
            rectToCheck.y < placed.y + placed.h &&
            rectToCheck.y + rectToCheck.h > placed.y
        ) {
            return true;
        }
    }
    return false;
}

function splitFreeRectSaw(freeRects, freeRect, usedW, usedH, gap) {
    let newFreeRects = [];
    if (usedW + gap < freeRect.w) {
        newFreeRects.push({
            x: freeRect.x + usedW + gap,
            y: freeRect.y,
            w: freeRect.w - usedW - gap,
            h: freeRect.h
        });
    }

    if (usedH + gap < freeRect.h) {
        newFreeRects.push({
            x: freeRect.x,
            y: freeRect.y + usedH + gap,
            w: freeRect.w,
            h: freeRect.h - usedH - gap
        });
    }

    const idx = freeRects.indexOf(freeRect);
    if (idx !== -1) {
        freeRects.splice(idx, 1);
    }
    return freeRects.concat(newFreeRects);
}

function calculateLayout() {
    // 移除之前的無效標記 (紅框)
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    let isValid = true;
    let firstInvalidElem = null;

    function markInvalid(elem) {
        isValid = false;
        if (elem) {
            elem.classList.add('is-invalid');
            if (!firstInvalidElem) firstInvalidElem = elem;
        }
    }

    // 1. 檢查參數設定區 下拉選單與輸入框
    const unitSelect = document.getElementById('unitSelect');
    if (!unitSelect.value) markInvalid(unitSelect);

    const allowRotationSelect = document.getElementById('allowRotationSelect');
    if (!allowRotationSelect.value) markInvalid(allowRotationSelect);

    const cutMethodSelect = document.getElementById('cutMethodSelect');
    if (!cutMethodSelect.value) markInvalid(cutMethodSelect);

    const boardWInput = document.getElementById('boardW');
    const boardHInput = document.getElementById('boardH');

    if (!boardWInput.value || parseFloat(boardWInput.value) <= 0) {
        markInvalid(boardWInput);
    } else {
        validatePositiveInput(boardWInput, 'dimension');
    }

    if (!boardHInput.value || parseFloat(boardHInput.value) <= 0) {
        markInvalid(boardHInput);
    } else {
        validatePositiveInput(boardHInput, 'dimension');
    }

    const gapInput = document.getElementById('gap');
    if (gapInput.value === '' || parseFloat(gapInput.value) < 0) {
        markInvalid(gapInput);
    } else {
        validatePositiveInput(gapInput, 'zeroAllowed');
    }

    // 2. 清理與檢驗切片需求清單
    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => {
        const wInput = row.querySelector('.item-w');
        const hInput = row.querySelector('.item-h');
        const countInput = row.querySelector('.item-count');

        const wVal = wInput.value.trim();
        const hVal = hInput.value.trim();
        const countVal = countInput.value.trim();

        // 需求 3：長、寬、高(數量)都空著，自動移除該行
        if (wVal === '' && hVal === '' && countVal === '') {
            row.remove();
            return;
        }

        // 若不是完全空白，則進行欄位內容校正與驗證
        if (wVal === '' || parseFloat(wVal) <= 0) {
            markInvalid(wInput);
        } else {
            validatePositiveInput(wInput, 'dimension');
        }

        if (hVal === '' || parseFloat(hVal) <= 0) {
            markInvalid(hInput);
        } else {
            validatePositiveInput(hInput, 'dimension');
        }

        if (countVal === '' || parseFloat(countVal) < 0) {
            markInvalid(countInput);
        } else {
            validatePositiveInput(countInput, 'zeroAllowed');
        }
    });

    const remainingRows = document.querySelectorAll('.item-row');

    // 若填寫不完整或無任何有效需求行
    if (!isValid || remainingRows.length === 0) {
        if (remainingRows.length === 0) {
            addItemRow('', '', '', false);
        }
        alert('請確認參數設定完整');
        if (firstInvalidElem) firstInvalidElem.focus();
        return;
    }

    // 3. 開始計算邏輯
    const boardW = parseFloat(boardWInput.value);
    const boardH = parseFloat(boardHInput.value);
    const gap = parseFloat(gapInput.value) || 0;
    const allowRotation = allowRotationSelect.value === 'true';
    const cutMethod = cutMethodSelect.value;

    let unplacedItems = [];

    remainingRows.forEach((row, idx) => {
        const wInput = row.querySelector('.item-w');
        const hInput = row.querySelector('.item-h');
        const countInput = row.querySelector('.item-count');

        const w = parseFloat(wInput.value);
        const h = parseFloat(hInput.value);
        const count = parseInt(countInput.value) || 0;

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
        alert('請輸入至少一組有效的切片長、寬與數量（數量需大於0）！');
        return;
    }

    unplacedItems.sort((a, b) => b.area - a.area);

    allSheetsResults = [];
    let totalPlacedAreaAllSheets = 0;
    let calculatedTotalPerimeter = 0;

    if (cutMethod === 'cnc') {
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

                for (let i = 0; i < freeRects.length; i++) {
                    let rect = freeRects[i];

                    if (item.w <= rect.w && item.h <= rect.h) {
                        bestFit = {
                            rectIdx: i, x: rect.x, y: rect.y, w: item.w, h: item.h
                        };
                        bestRotated = false;
                        break;
                    }
                    if (allowRotation && item.h <= rect.w && item.w <= rect.h) {
                        bestFit = {
                            rectIdx: i, x: rect.x, y: rect.y, w: item.h, h: item.w
                        };
                        bestRotated = true;
                        break;
                    }
                }

                if (bestFit) {
                    placedInThisSheet.push({
                        x: bestFit.x, y: bestFit.y,
                        w: bestFit.w, h: bestFit.h,
                        origW: item.w, origH: item.h,
                        rotated: bestRotated
                    });
                    sheetPlacedArea += item.area;
                    calculatedTotalPerimeter += 2 * (item.w + item.h);

                    let usedRect = freeRects.splice(bestFit.rectIdx, 1)[0];

                    if (usedRect.w - bestFit.w - gap > 0) {
                        freeRects.push({
                            x: bestFit.x + bestFit.w + gap,
                            y: bestFit.y,
                            w: usedRect.w - bestFit.w - gap,
                            h: bestFit.h
                        });
                    }
                    if (usedRect.h - bestFit.h - gap > 0) {
                        freeRects.push({
                            x: bestFit.x,
                            y: bestFit.y + bestFit.h + gap,
                            w: usedRect.w,
                            h: usedRect.h - bestFit.h - gap
                        });
                    }
                } else {
                    remainingItemsForNextSheet.push(item);
                }
            }

            if (placedInThisSheet.length === 0) break;

            totalPlacedAreaAllSheets += sheetPlacedArea;
            allSheetsResults.push({
                placedItems: placedInThisSheet,
                usage: ((sheetPlacedArea / (boardW * boardH)) * 100).toFixed(1)
            });

            unplacedItems = remainingItemsForNextSheet;
        }
    } else {
        while (unplacedItems.length > 0) {
            let freeRects = [{
                x: 0, y: 0, w: boardW, h: boardH
            }];
            let placedInThisSheet = [];
            let sheetPlacedArea = 0;

            let i = 0;
            while (i < unplacedItems.length) {
                let item = unplacedItems[i];
                let placed = false;

                for (let r = 0; r < freeRects.length; r++) {
                    let freeRect = freeRects[r];
                    if (
                        item.w <= freeRect.w &&
                        item.h <= freeRect.h &&
                        !isOverlapping(placedInThisSheet, freeRect, item.w, item.h)
                    ) {
                        placedInThisSheet.push({
                            x: freeRect.x,
                            y: freeRect.y,
                            w: item.w,
                            h: item.h,
                            origW: item.w,
                            origH: item.h,
                            rotated: false
                        });
                        sheetPlacedArea += item.area;
                        calculatedTotalPerimeter += 2 * (item.w + item.h);

                        freeRects = splitFreeRectSaw(freeRects, freeRect, item.w, item.h, gap);
                        placed = true;
                        break;
                    }
                    if (allowRotation) {
                        if (
                            item.h <= freeRect.w &&
                            item.w <= freeRect.h &&
                            !isOverlapping(placedInThisSheet, freeRect, item.h, item.w)
                        ) {
                            placedInThisSheet.push({
                                x: freeRect.x,
                                y: freeRect.y,
                                w: item.h,
                                h: item.w,
                                origW: item.w,
                                origH: item.h,
                                rotated: true
                            });
                            sheetPlacedArea += item.area;
                            calculatedTotalPerimeter += 2 * (item.w + item.h);

                            freeRects = splitFreeRectSaw(freeRects, freeRect, item.h, item.w, gap);
                            placed = true;
                            break;
                        }
                    }
                }

                if (placed) {
                    unplacedItems.splice(i, 1);
                } else {
                    i++;
                }
            }

            if (placedInThisSheet.length === 0) break;

            totalPlacedAreaAllSheets += sheetPlacedArea;
            allSheetsResults.push({
                placedItems: placedInThisSheet,
                usage: ((sheetPlacedArea / (boardW * boardH)) * 100).toFixed(1)
            });
        }
    }

    const totalBoardsArea = allSheetsResults.length * (boardW * boardH);
    const avgUsage = totalBoardsArea > 0 ? ((totalPlacedAreaAllSheets / totalBoardsArea) * 100).toFixed(1): 0;

    lastTotalPerimeter = calculatedTotalPerimeter;

    document.getElementById('statUsage').innerText = `${avgUsage}%`;
    document.getElementById('statSheets').innerText = allSheetsResults.length;
    updatePerimeterDisplay();

    // 需求 2：計算後啟用按鈕並移除提示詞
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    exportPdfBtn.disabled = false;
    exportPdfBtn.removeAttribute('title');

    renderTabs(boardW, boardH);
    if (allSheetsResults.length > 0) {
        switchSheet(0, boardW, boardH);
    }
}

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

function switchSheet(index, boardW, boardH) {
    const sheet = allSheetsResults[index];
    if (sheet) {
        renderCanvas(boardW, boardH, sheet.placedItems);
    }
}

function renderCanvas(boardW, boardH, placedItems) {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';

    const canvas = document.createElement('canvas');

    const maxCanvasWidth = Math.min(container.clientWidth - 32, 1000);
    const scale = maxCanvasWidth / boardW;

    canvas.width = boardW * scale;
    canvas.height = boardH * scale;
    container.appendChild(canvas);

    drawSheetToCanvas(canvas, boardW, boardH, placedItems, scale);
}

function drawSheetToCanvas(canvas, boardW, boardH, placedItems, scale) {
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e8d8c3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const colors = ['#1e40af', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#9333ea', '#059669'];

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

        if (w > 28 && h > 16) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.max(10, Math.min(13, w / 5))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = `${item.origW}×${item.origH}${item.rotated ? ' ↻': ''}`;
            ctx.fillText(label, x + w / 2, y + h / 2);
        }
    });
}

function exportToPDF() {
    if (allSheetsResults.length === 0) return;

    const boardW = parseFloat(document.getElementById('boardW').value);
    const boardH = parseFloat(document.getElementById('boardH').value);
    const container = document.getElementById('canvasContainer');

    container.innerHTML = '';

    allSheetsResults.forEach((sheet, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-sheet-wrapper';

        const title = document.createElement('div');
        title.className = 'pdf-sheet-title';
        title.innerText = `底板 #${idx + 1} (利用率: ${sheet.usage}%)`;
        wrapper.appendChild(title);

        const canvas = document.createElement('canvas');
        const scale = 800 / boardW;
        canvas.width = boardW * scale;
        canvas.height = boardH * scale;

        drawSheetToCanvas(canvas, boardW, boardH, sheet.placedItems, scale);
        wrapper.appendChild(canvas);

        container.appendChild(wrapper);
    });

    window.print();

    switchSheet(0, boardW, boardH);
}
