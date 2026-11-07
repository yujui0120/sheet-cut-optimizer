import { state } from './config.js';
import { isOverlapping, optimizeCNC, optimizeSaw } from './optimizer.js';
import { verifyUserAccess } from './auth.js';

async function loadModals() {
    try {
        const [noticeRes, guideRes] = await Promise.all([
            fetch('notice.html'),
            fetch('guide.html')
        ]);
        const noticeHtml = await noticeRes.text();
        const guideHtml = await guideRes.text();

        const container = document.getElementById('modalContainer');
        if (container) {
            container.innerHTML = noticeHtml + guideHtml;
            setupModalScrollLock();
        }
    } catch (err) {}
}

function setupModalScrollLock() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        const modalBody = backdrop.querySelector('.modal-body');
        if (!modalBody) return;

        modalBody.addEventListener('wheel', (e) => {
            const scrollTop = modalBody.scrollTop;
            const scrollHeight = modalBody.scrollHeight;
            const height = modalBody.clientHeight;
            const delta = e.deltaY;

            if (delta < 0 && scrollTop <= 0) {
                e.preventDefault();
            } else if (delta > 0 && (scrollTop + height >= scrollHeight)) {
                e.preventDefault();
            }
        }, { passive: false });
    });
}

window.onload = async () => {
    await loadModals();
    verifyUserAccess(() => {
        const loader = document.getElementById('initialLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                window.grantAccessAfterAuth();
            }, 300);
        } else {
            window.grantAccessAfterAuth();
        }
    });
};

window.grantAccessAfterAuth = function() {
    window.addItemRow('', '', '', '', false);
    updateThicknessVisibilityUI();
    updatePerimeterDisplay();
    openNoticeModal();
};

window.openGuideModal = function() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.querySelectorAll('.notice-section').forEach(section => {
            section.classList.remove('active');
            const list = section.querySelector('.modal-notice-list');
            if (list) list.style.display = 'none';
        });
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('show'); }, 10);
    }
};

window.closeGuideModal = function() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
};

window.toggleNoticeSection = function(headerElem) {
    const section = headerElem.closest('.notice-section');
    const modalBody = section.closest('.modal-body');
    const list = section.querySelector('.modal-notice-list');
    const isActive = section.classList.contains('active');

    if (section.closest('#guideModal')) {
        modalBody.querySelectorAll('.notice-section').forEach(s => {
            s.classList.remove('active');
            const l = s.querySelector('.modal-notice-list');
            if (l) l.style.display = 'none';
        });
    }

    if (!isActive) {
        section.classList.add('active');
        list.style.display = 'block';
    }
};

window.toggleThicknessColumn = function(forceState = null) {
    if (forceState !== null) {
        state.isThicknessVisible = forceState;
    } else {
        state.isThicknessVisible = !state.isThicknessVisible;
    }
    updateThicknessVisibilityUI();
    saveDraftToLocalStorage();
};

function updateThicknessVisibilityUI() {
    const header = document.getElementById('itemListHeader');
    const headerThickSpan = header ? header.querySelector('.col-thickness') : null;

    if (header) {
        if (state.isThicknessVisible) {
            header.classList.remove('hide-d');
            if (headerThickSpan) headerThickSpan.classList.remove('hidden-col');
        } else {
            header.classList.add('hide-d');
            if (headerThickSpan) headerThickSpan.classList.add('hidden-col');
        }
    }

    document.querySelectorAll('.item-row').forEach(row => {
        const dInput = row.querySelector('.item-d');
        if (state.isThicknessVisible) {
            row.classList.remove('hide-d');
            if (dInput) dInput.classList.remove('hidden-col');
        } else {
            row.classList.add('hide-d');
            if (dInput) dInput.classList.add('hidden-col');
        }
    });

    const toggleBtn = document.getElementById('toggleThicknessBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = state.isThicknessVisible ? '👁️ 隱藏厚度' : '👁️ 顯示厚度';
    }
}

window.openNoticeModal = function() {
    const modal = document.getElementById('noticeModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('show'); }, 10);
    }
};

window.closeNoticeModal = function() {
    const noticeModal = document.getElementById('noticeModal');
    if (noticeModal) {
        noticeModal.classList.remove('show');
        setTimeout(() => {
            noticeModal.style.display = 'none';
            checkAndRestoreDraft();
        }, 300);
    }
};

window.openContactModal = function() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('show'); }, 10);
    }
};

window.closeContactModal = function() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
};

function saveDraftToLocalStorage() {
    if (state.hasCalculated) return;

    const draftData = {
        unitSelect: document.getElementById('unitSelect').value,
        boardW: document.getElementById('boardW').value,
        boardH: document.getElementById('boardH').value,
        gap: document.getElementById('gap').value,
        allowRotationSelect: document.getElementById('allowRotationSelect').value,
        cutMethodSelect: document.getElementById('cutMethodSelect').value,
        isThicknessVisible: state.isThicknessVisible,
        items: []
    };

    document.querySelectorAll('.item-row').forEach(row => {
        draftData.items.push({
            w: row.querySelector('.item-w').value,
            h: row.querySelector('.item-h').value,
            d: row.querySelector('.item-d').value,
            count: row.querySelector('.item-count').value
        });
    });

    localStorage.setItem('wood_calc_draft', JSON.stringify(draftData));
}

function checkAndRestoreDraft() {
    const saved = localStorage.getItem('wood_calc_draft');
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        let hasData = false;

        if (data.unitSelect && data.unitSelect !== '') hasData = true;
        if (data.boardW && data.boardW !== '2440') hasData = true;
        if (data.boardH && data.boardH !== '1220') hasData = true;
        if (data.gap && data.gap !== '3' && data.gap !== 3) hasData = true;
        if (data.allowRotationSelect && data.allowRotationSelect !== '') hasData = true;
        if (data.cutMethodSelect && data.cutMethodSelect !== '') hasData = true;

        if (data.items && data.items.length > 0) {
            data.items.forEach(it => {
                if ((it.w && it.w !== '') || (it.h && it.h !== '') || (it.d && it.d !== '') || (it.count && it.count !== '')) {
                    hasData = true;
                }
            });
        }

        if (!hasData) {
            localStorage.removeItem('wood_calc_draft');
            return;
        }

        if (confirm('偵測到您上次有尚未計算的輸入進度，請問是否需要還原？')) {
            if (data.unitSelect) document.getElementById('unitSelect').value = data.unitSelect;
            if (data.boardW) document.getElementById('boardW').value = data.boardW;
            if (data.boardH) document.getElementById('boardH').value = data.boardH;
            if (data.gap) document.getElementById('gap').value = data.gap;
            if (data.allowRotationSelect) document.getElementById('allowRotationSelect').value = data.allowRotationSelect;
            if (data.cutMethodSelect) document.getElementById('cutMethodSelect').value = data.cutMethodSelect;

            if (data.unitSelect) state.currentUnit = data.unitSelect;
            state.isThicknessVisible = !!data.isThicknessVisible;
            updateThicknessVisibilityUI();

            const container = document.getElementById('itemList');
            container.innerHTML = '';
            if (data.items && data.items.length > 0) {
                data.items.forEach(it => {
                    window.addItemRow(it.w, it.h, it.d, it.count, false);
                });
            } else {
                window.addItemRow('', '', '', '', false);
            }
            updatePerimeterDisplay();
        } else {
            localStorage.removeItem('wood_calc_draft');
        }
    } catch (e) {
        localStorage.removeItem('wood_calc_draft');
    }
}

window.validatePositiveInput = function(input, type = 'dimension') {
    if (input.value === '') return;

    const val = parseFloat(input.value);
    if (type === 'zeroAllowed') {
        if (isNaN(val) || val < 0) input.value = 0;
    } else {
        if (isNaN(val) || val <= 0) input.value = 1;
    }
    saveDraftToLocalStorage();
};

window.clearInvalidMark = function(element) {
    if (element) element.classList.remove('is-invalid');
};

window.clearAllItems = function() {
    if (confirm('確定要清除所有切片需求項目嗎？')) {
        const container = document.getElementById('itemList');
        container.innerHTML = '';
        window.addItemRow('', '', '', '', false);
        saveDraftToLocalStorage();
    }
};

window.addItemRow = function(w = '', h = '', d = '', count = '', focusFirst = false) {
    const container = document.getElementById('itemList');
    const div = document.createElement('div');
    div.className = `item-row ${state.isThicknessVisible ? '' : 'hide-d'}`;
    div.innerHTML = `
    <input type="number" class="form-control item-w" placeholder="長" value="${w}" min="1" step="any" onchange="validatePositiveInput(this, 'dimension'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <button type="button" class="btn-swap" title="交換長寬" onclick="swapRowDimensions(this)">⮂</button>
    <input type="number" class="form-control item-h" placeholder="寬" value="${h}" min="1" step="any" onchange="validatePositiveInput(this, 'dimension'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <input type="number" class="form-control item-d ${state.isThicknessVisible ? '' : 'hidden-col'}" placeholder="厚" value="${d}" min="0" step="any" onchange="validatePositiveInput(this, 'zeroAllowed'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <input type="number" class="form-control item-count" placeholder="數量" value="${count}" min="0" step="1" onchange="validatePositiveInput(this, 'zeroAllowed'); clearInvalidMark(this);" onkeydown="handleKeyNavigation(event, this)">
    <button class="btn-delete" title="刪除此列" onclick="this.parentElement.remove(); saveDraftToLocalStorage();">✕</button>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    if (focusFirst) {
        const inputW = div.querySelector('.item-w');
        if (inputW) inputW.focus();
    }
    saveDraftToLocalStorage();
};

window.swapRowDimensions = function(button) {
    const row = button.closest('.item-row');
    const wInput = row.querySelector('.item-w');
    const hInput = row.querySelector('.item-h');
    const temp = wInput.value;
    wInput.value = hInput.value;
    hInput.value = temp;
    saveDraftToLocalStorage();
};

window.swapBoardDimensions = function() {
    const wInput = document.getElementById('boardW');
    const hInput = document.getElementById('boardH');
    const temp = wInput.value;
    wInput.value = hInput.value;
    hInput.value = temp;
    saveDraftToLocalStorage();
};

window.handleKeyNavigation = function(event, currentInput) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const type = currentInput.classList.contains('item-count') ? 'zeroAllowed' : (currentInput.classList.contains('item-d') ? 'zeroAllowed' : 'dimension');
        window.validatePositiveInput(currentInput, type);

        const row = currentInput.closest('.item-row');
        const rowInputs = Array.from(row.querySelectorAll('input[type="number"]:not(.hidden-col)'));
        const currentIndex = rowInputs.indexOf(currentInput);

        if (currentIndex < rowInputs.length - 1) {
            rowInputs[currentIndex + 1].focus();
            rowInputs[currentIndex + 1].select();
        } else {
            const allRows = Array.from(document.querySelectorAll('.item-row'));
            const currentRowIndex = allRows.indexOf(row);

            if (currentRowIndex === allRows.length - 1) {
                window.addItemRow('', '', '', '', true);
            } else {
                const nextRowFirstInput = allRows[currentRowIndex + 1].querySelector('.item-w');
                if (nextRowFirstInput) {
                    nextRowFirstInput.focus();
                    nextRowFirstInput.select();
                }
            }
        }
        saveDraftToLocalStorage();
    }
};

window.handleUnitChange = function(newUnit) {
    if (!newUnit) return;

    if (!state.currentUnit) {
        state.currentUnit = newUnit;
        saveDraftToLocalStorage();
        return;
    }

    if (newUnit === state.currentUnit) return;

    const factor = newUnit === 'cm' ? 0.1 : 10;

    ['boardW', 'boardH', 'gap'].forEach(id => {
        const input = document.getElementById(id);
        if (input && input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    document.querySelectorAll('.item-w, .item-h, .item-d').forEach(input => {
        if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
    });

    if (state.lastTotalPerimeter > 0) {
        state.lastTotalPerimeter = state.lastTotalPerimeter * factor;
    }

    state.currentUnit = newUnit;
    updatePerimeterDisplay();
    saveDraftToLocalStorage();
};

function updatePerimeterDisplay() {
    const formattedPerimeter = state.lastTotalPerimeter.toFixed(1).replace(/\.0$/, '');
    const unitText = state.currentUnit ? state.currentUnit : 'mm';
    document.getElementById('statPerimeter').innerText = `${formattedPerimeter} ${unitText}`;
}

window.downloadDataExcel = function() {
    const unit = document.getElementById('unitSelect').value || 'mm';
    const boardW = document.getElementById('boardW').value || '';
    const boardH = document.getElementById('boardH').value || '';
    const boardSizeStr = `${boardW}*${boardH}`;
    const gap = document.getElementById('gap').value || '';
    const allowRotationVal = document.getElementById('allowRotationSelect').value;
    const allowRotation = allowRotationVal === 'true' ? '是' : (allowRotationVal === 'false' ? '否' : '');
    const cutMethodVal = document.getElementById('cutMethodSelect').value;
    const cutMethod = cutMethodVal === 'cnc' ? 'CNC裁切' : (cutMethodVal === 'saw' ? '裁板機裁切' : '');

    const excelRows = [
        [`單位：${unit}`, `底板長*寬：${boardSizeStr}`, `間距：${gap}`, `是否允許旋轉：${allowRotation}`, `裁切方式：${cutMethod}`],
        ['', '', '', '', ''],
        ['長', '寬', '厚', '數量', '']
    ];

    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => {
        const w = row.querySelector('.item-w').value;
        const h = row.querySelector('.item-h').value;
        const d = row.querySelector('.item-d').value;
        const count = row.querySelector('.item-count').value;

        if (w !== '' || h !== '' || d !== '' || count !== '') {
            excelRows.push([
                w !== '' ? parseFloat(w) : '',
                h !== '' ? parseFloat(h) : '',
                d !== '' ? parseFloat(d) : '',
                count !== '' ? parseInt(count) : '',
                ''
            ]);
        }
    });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `木板最大利用與裁切計算器數據_${timeStr}.xlsx`;

    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "裁切需求清單");
    XLSX.writeFile(workbook, fileName);
};

window.handleExcelUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 8) {
                alert('Excel 檔案內的資料不足 8 行，無法從第 8 行開始讀取！');
                return;
            }

            const maxCols = Math.max(...jsonData.slice(7).map(r => r.length));
            state.excelHeaders = Array.from({ length: maxCols }, (_, i) => {
                const headerVal = jsonData[7][i];
                return (headerVal !== undefined && headerVal !== null) ? String(headerVal).trim() : `第 ${i + 1} 欄`;
            });

            state.parsedExcelData = jsonData.slice(7);
            openExcelModal();
        } catch (err) {
            alert('解析 Excel 檔案失敗，請確認檔案格式是否正確。');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

function openExcelModal() {
    const modal = document.getElementById('excelModal');
    const selectW = document.getElementById('colSelectW');
    const selectH = document.getElementById('colSelectH');
    const selectD = document.getElementById('colSelectD');
    const selectCount = document.getElementById('colSelectCount');

    [selectW, selectH, selectD, selectCount].forEach(sel => sel.innerHTML = '');

    state.excelHeaders.forEach((header, idx) => {
        const optW = new Option(`${header} (欄 ${idx+1})`, idx);
        const optH = new Option(`${header} (欄 ${idx+1})`, idx);
        const optD = new Option(`${header} (欄 ${idx+1})`, idx);
        const optCount = new Option(`${header} (欄 ${idx+1})`, idx);

        selectW.add(optW);
        selectH.add(optH);
        selectD.add(optD);
        selectCount.add(optCount);
    });

    if (state.excelHeaders.length >= 6) selectW.value = 5;
    if (state.excelHeaders.length >= 7) selectH.value = 6;
    if (state.excelHeaders.length >= 8) selectD.value = 7;
    if (state.excelHeaders.length >= 10) selectCount.value = 9;

    state.excelHeaders.forEach((h, idx) => {
        const headerLower = h.toLowerCase();
        if (headerLower.includes('長') || headerLower.includes('length') || headerLower.includes('w')) selectW.value = idx;
        if (headerLower.includes('寬') || headerLower.includes('width') || headerLower.includes('h')) selectH.value = idx;
        if (headerLower.includes('厚') || headerLower.includes('thick') || headerLower.includes('depth') || headerLower.includes('d')) selectD.value = idx;
        if (headerLower.includes('數') || headerLower.includes('量') || headerLower.includes('count') || headerLower.includes('qty')) selectCount.value = idx;
    });

    ['W', 'H', 'D', 'Count'].forEach(k => {
        document.getElementById(`filterType${k}`).value = 'none';
        document.getElementById(`filterVal${k}`).value = '';
    });

    renderExcelPreviewTable();
    modal.style.display = 'flex';
}

window.closeExcelModal = function() {
    document.getElementById('excelModal').style.display = 'none';
};

function renderExcelPreviewTable() {
    const container = document.getElementById('excelPreviewTableContainer');
    let html = '<table class="preview-table"><thead><tr>';
    state.excelHeaders.forEach((_, colIdx) => {
        const colNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        const numStr = colIdx < 10 ? colNames[colIdx] : (colIdx + 1);
        html += `<th style="background:#e2e8f0; font-weight:700; text-align:center; padding:6px 10px; border:1px solid var(--border); font-size:0.8rem; position:sticky; top:0; z-index:1;">第${numStr}欄</th>`;
    });
    html += '</tr></thead><tbody>';

    const previewRows = state.parsedExcelData.slice(0, 6);
    previewRows.forEach(row => {
        html += '<tr>';
        state.excelHeaders.forEach((_, colIdx) => {
            const val = row[colIdx] !== undefined ? row[colIdx] : '';
            html += `<td>${val}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function checkPassFilter(val, filterType, filterValStr) {
    if (filterType === 'none') return true;
    if (!filterValStr || filterValStr.trim() === '') return true;
    const targetStr = String(val !== undefined && val !== null ? val : '').trim();
    const conditionStr = filterValStr.trim();

    if (filterType === 'include') return targetStr === conditionStr;
    if (filterType === 'exclude') return targetStr !== conditionStr;
    return true;
}

window.confirmExcelImport = function() {
    const colWIdx = parseInt(document.getElementById('colSelectW').value);
    const colHIdx = parseInt(document.getElementById('colSelectH').value);
    const colDIdx = parseInt(document.getElementById('colSelectD').value);
    const colCountIdx = parseInt(document.getElementById('colSelectCount').value);

    const filterTypeW = document.getElementById('filterTypeW').value;
    const filterValW = document.getElementById('filterValW').value;
    const filterTypeH = document.getElementById('filterTypeH').value;
    const filterValH = document.getElementById('filterValH').value;
    const filterTypeD = document.getElementById('filterTypeD').value;
    const filterValD = document.getElementById('filterValD').value;
    const filterTypeCount = document.getElementById('filterTypeCount').value;
    const filterValCount = document.getElementById('filterValCount').value;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    const itemListContainer = document.getElementById('itemList');

    if (importMode === 'replace') itemListContainer.innerHTML = '';

    let importedRowsCount = 0;
    let hasValidThickness = false;

    state.parsedExcelData.forEach(row => {
        const valW = row[colWIdx];
        const valH = row[colHIdx];
        const valD = row[colDIdx];
        const valCount = row[colCountIdx];

        if (!checkPassFilter(valW, filterTypeW, filterValW)) return;
        if (!checkPassFilter(valH, filterTypeH, filterValH)) return;
        if (!checkPassFilter(valD, filterTypeD, filterValD)) return;
        if (!checkPassFilter(valCount, filterTypeCount, filterValCount)) return;

        const rawW = parseFloat(valW);
        const rawH = parseFloat(valH);
        const rawD = parseFloat(valD);
        let rawCount = parseInt(valCount);

        if (isNaN(rawCount) || rawCount < 1) rawCount = 1;

        const validD = !isNaN(rawD) && rawD >= 0 ? rawD : '';
        if (validD !== '') hasValidThickness = true;

        if (!isNaN(rawW) && !isNaN(rawH) && rawW > 0 && rawH > 0) {
            window.addItemRow(rawW, rawH, validD, rawCount);
            importedRowsCount++;
        }
    });

    if (hasValidThickness) window.toggleThicknessColumn(true);

    if (importedRowsCount === 0) {
        alert('未能依據篩選條件匯入任何有效數字資料，請檢查篩選設定或欄位數值是否正確。');
    } else {
        alert(`成功依篩選條件匯入 ${importedRowsCount} 筆切片尺寸數據！`);
        window.closeExcelModal();
        saveDraftToLocalStorage();
    }
};

window.calculateLayout = function() {
    const calcBtn = document.getElementById('calcBtn');
    calcBtn.disabled = true;
    calcBtn.innerText = '計算中...';

    setTimeout(() => {
        try {
            executeCalculation();
        } finally {
            calcBtn.disabled = false;
            calcBtn.innerText = '開始計算';
        }
    }, 50);
};

function executeCalculation() {
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

    const unitSelect = document.getElementById('unitSelect');
    if (!unitSelect.value) markInvalid(unitSelect);

    const allowRotationSelect = document.getElementById('allowRotationSelect');
    if (!allowRotationSelect.value) markInvalid(allowRotationSelect);

    const cutMethodSelect = document.getElementById('cutMethodSelect');
    if (!cutMethodSelect.value) markInvalid(cutMethodSelect);

    const boardWInput = document.getElementById('boardW');
    const boardHInput = document.getElementById('boardH');

    if (!boardWInput.value || parseFloat(boardWInput.value) <= 0) markInvalid(boardWInput);
    else window.validatePositiveInput(boardWInput, 'dimension');

    if (!boardHInput.value || parseFloat(boardHInput.value) <= 0) markInvalid(boardHInput);
    else window.validatePositiveInput(boardHInput, 'dimension');

    const gapInput = document.getElementById('gap');
    if (gapInput.value === '' || parseFloat(gapInput.value) < 0) markInvalid(gapInput);
    else window.validatePositiveInput(gapInput, 'zeroAllowed');

    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => {
        const wInput = row.querySelector('.item-w');
        const hInput = row.querySelector('.item-h');
        const dInput = row.querySelector('.item-d');
        const countInput = row.querySelector('.item-count');

        const wVal = wInput.value.trim();
        const hVal = hInput.value.trim();
        const dVal = dInput.value.trim();
        const countVal = countInput.value.trim();

        if (wVal === '' && hVal === '' && dVal === '' && countVal === '') {
            row.remove();
            return;
        }

        if (wVal === '' || parseFloat(wVal) <= 0) markInvalid(wInput);
        else window.validatePositiveInput(wInput, 'dimension');

        if (hVal === '' || parseFloat(hVal) <= 0) markInvalid(hInput);
        else window.validatePositiveInput(hInput, 'dimension');

        if (dVal !== '' && parseFloat(dVal) < 0) markInvalid(dInput);
        else if (dVal !== '') window.validatePositiveInput(dInput, 'zeroAllowed');

        if (countVal === '' || parseFloat(countVal) < 0) markInvalid(countInput);
        else window.validatePositiveInput(countInput, 'zeroAllowed');
    });

    const remainingRows = document.querySelectorAll('.item-row');

    if (!isValid || remainingRows.length === 0) {
        if (remainingRows.length === 0) window.addItemRow('', '', '', '', false);
        alert('請確認參數設定完整');
        if (firstInvalidElem) firstInvalidElem.focus();
        return;
    }

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
                unplacedItems.push({ id: `組${idx+1}-${i+1}`, w, h, area: w * h });
            }
        }
    });

    if (unplacedItems.length === 0) {
        alert('請輸入至少一組有效的切片長、寬與數量（數量需大於0）！');
        return;
    }

    let result;
    if (cutMethod === 'cnc') {
        result = optimizeCNC(boardW, boardH, gap, allowRotation, unplacedItems);
    } else {
        result = optimizeSaw(boardW, boardH, gap, allowRotation, unplacedItems);
    }

    state.allSheetsResults = result.allSheetsResults;
    state.lastTotalPerimeter = result.totalPerimeter;
    state.globalDimColorMap = result.globalDimColorMap;

    let totalPlacedAreaAllSheets = 0;
    state.allSheetsResults.forEach(sheet => {
        sheet.placedItems.forEach(item => {
            totalPlacedAreaAllSheets += (item.origW * item.origH);
        });
    });

    const totalBoardsArea = state.allSheetsResults.length * (boardW * boardH);
    const avgUsage = totalBoardsArea > 0 ? ((totalPlacedAreaAllSheets / totalBoardsArea) * 100).toFixed(1) : 0;

    document.getElementById('statUsage').innerText = `${avgUsage}%`;
    document.getElementById('statSheets').innerText = state.allSheetsResults.length;
    updatePerimeterDisplay();

    const exportPdfBtn = document.getElementById('exportPdfBtn');
    exportPdfBtn.disabled = false;
    exportPdfBtn.removeAttribute('title');

    const toggleDragBtn = document.getElementById('toggleDragBtn');
    if (toggleDragBtn) toggleDragBtn.disabled = false;

    state.hasCalculated = true;
    localStorage.removeItem('wood_calc_draft');

    state.currentActiveSheetIndex = 0;
    renderTabs(boardW, boardH);
    if (state.allSheetsResults.length > 0) {
        switchSheet(0, boardW, boardH);
    }
}

window.toggleDragMode = function() {
    state.isDragMode = !state.isDragMode;
    const btn = document.getElementById('toggleDragBtn');
    if (btn) {
        btn.innerText = state.isDragMode ? '🖐️ 退出拖曳' : '🖐️ 拖曳模式';
        if (state.isDragMode) btn.classList.add('active-drag-mode');
        else btn.classList.remove('active-drag-mode');
    }

    const boardW = parseFloat(document.getElementById('boardW').value);
    const boardH = parseFloat(document.getElementById('boardH').value);
    switchSheet(state.currentActiveSheetIndex, boardW, boardH);
};

function updateSheetStats() {
    const boardW = parseFloat(document.getElementById('boardW').value);
    const boardH = parseFloat(document.getElementById('boardH').value);
    const boardArea = boardW * boardH;

    let totalPlacedAreaAllSheets = 0;
    state.allSheetsResults.forEach((sheet) => {
        let sheetArea = 0;
        sheet.placedItems.forEach(item => { sheetArea += item.origW * item.origH; });
        sheet.usage = ((sheetArea / boardArea) * 100).toFixed(1);
        totalPlacedAreaAllSheets += sheetArea;
    });

    const totalBoardsArea = state.allSheetsResults.length * boardArea;
    const avgUsage = totalBoardsArea > 0 ? ((totalPlacedAreaAllSheets / totalBoardsArea) * 100).toFixed(1) : 0;
    document.getElementById('statUsage').innerText = `${avgUsage}%`;

    renderTabs(boardW, boardH);
}

function renderTabs(boardW, boardH) {
    const tabsContainer = document.getElementById('sheetTabs');
    tabsContainer.innerHTML = '';

    state.allSheetsResults.forEach((sheet, idx) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${idx === state.currentActiveSheetIndex ? 'active' : ''}`;
        btn.innerText = `底板 #${idx + 1} (${sheet.usage}%)`;
        
        btn.onclick = () => {
            state.currentActiveSheetIndex = idx;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchSheet(idx, boardW, boardH);
        };

        btn.ondragover = (e) => {
            e.preventDefault();
            if (state.currentActiveSheetIndex !== idx) {
                state.currentActiveSheetIndex = idx;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                switchSheet(idx, boardW, boardH);
            }
        };

        tabsContainer.appendChild(btn);
    });
}

function switchSheet(index, boardW, boardH) {
    state.currentActiveSheetIndex = index;
    const sheet = state.allSheetsResults[index];
    if (sheet) {
        renderCanvas(boardW, boardH, sheet.placedItems);
    }
}

function renderCanvas(boardW, boardH, placedItems) {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';

    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.position = 'relative';
    canvasWrapper.style.display = 'inline-block';

    const canvas = document.createElement('canvas');
    const maxCanvasWidth = Math.min(container.clientWidth - 32, 1000);
    const scale = maxCanvasWidth / boardW;

    canvas.width = boardW * scale;
    canvas.height = boardH * scale;

    canvasWrapper.appendChild(canvas);
    container.appendChild(canvasWrapper);

    drawSheetToCanvas(canvas, boardW, boardH, placedItems, scale);

    if (state.isDragMode) {
        setupInteractiveDragOverlay(canvasWrapper, canvas, boardW, boardH, placedItems, scale);
    }
}

function setupInteractiveDragOverlay(wrapper, canvas, boardW, boardH, placedItems, scale) {
    const gap = parseFloat(document.getElementById('gap').value) || 0;
    const allowRotation = document.getElementById('allowRotationSelect').value === 'true';
    const cutMethod = document.getElementById('cutMethodSelect').value;

    placedItems.forEach((item, itemIdx) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.left = `${item.x * scale}px`;
        overlay.style.top = `${item.y * scale}px`;
        overlay.style.width = `${item.w * scale}px`;
        overlay.style.height = `${item.h * scale}px`;
        overlay.style.cursor = 'grab';
        overlay.style.border = '2px dashed #ffffff';
        overlay.style.boxSizing = 'border-box';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        overlay.draggable = true;

        overlay.ondragstart = (e) => {
            state.draggedItemInfo = {
                fromSheetIndex: state.currentActiveSheetIndex,
                itemIndex: itemIdx,
                itemData: { ...item, origW: item.origW, origH: item.origH }
            };
            overlay.style.opacity = '0.4';
            e.dataTransfer.setData('text/plain', JSON.stringify(item));
        };

        overlay.ondragend = () => { overlay.style.opacity = '1'; };

        wrapper.appendChild(overlay);
    });

    wrapper.ondragover = (e) => { e.preventDefault(); };

    wrapper.ondrop = (e) => {
        e.preventDefault();
        if (!state.draggedItemInfo) return;

        const canvasRect = canvas.getBoundingClientRect();
        const dropPixelX = e.clientX - canvasRect.left;
        const dropPixelY = e.clientY - canvasRect.top;

        let rawX = dropPixelX / scale;
        let rawY = dropPixelY / scale;

        const originalItem = state.draggedItemInfo.itemData;
        const targetSheet = state.allSheetsResults[state.currentActiveSheetIndex];
        const targetPlacedItems = targetSheet.placedItems;

        const isSameSheet = state.draggedItemInfo.fromSheetIndex === state.currentActiveSheetIndex;
        const ignoreIdx = isSameSheet ? state.draggedItemInfo.itemIndex : -1;

        let fitW = originalItem.w;
        let fitH = originalItem.h;
        let fitRotated = originalItem.rotated;

        let targetX = rawX;
        let targetY = rawY;
        const snapThreshold = 15;

        let snapXCandidates = [0, boardW - fitW];
        let snapYCandidates = [0, boardH - fitH];

        targetPlacedItems.forEach((p, idx) => {
            if (idx === ignoreIdx) return;
            snapXCandidates.push(p.x, p.x + p.w + gap, p.x - fitW - gap);
            snapYCandidates.push(p.y, p.y + p.h + gap, p.y - fitH - gap);
        });

        let bestX = rawX;
        let minXDist = Infinity;
        snapXCandidates.forEach(cand => {
            let dist = Math.abs((rawX * scale) - (cand * scale));
            if (dist < minXDist && dist <= snapThreshold) {
                minXDist = dist;
                bestX = cand;
            }
        });

        let bestY = rawY;
        let minYDist = Infinity;
        snapYCandidates.forEach(cand => {
            let dist = Math.abs((rawY * scale) - (cand * scale));
            if (dist < minYDist && dist <= snapThreshold) {
                minYDist = dist;
                bestY = cand;
            }
        });

        targetX = bestX;
        targetY = bestY;

        let canPlace = false;
        const checkInBounds = (x, y, w, h) => x >= 0 && y >= 0 && (x + w) <= boardW + 0.001 && (y + h) <= boardH + 0.001;

        if (checkInBounds(targetX, targetY, fitW, fitH) && !isOverlapping(targetPlacedItems, { x: targetX, y: targetY, w: fitW, h: fitH }, ignoreIdx, gap)) {
            canPlace = true;
        } else if (allowRotation) {
            const rotW = originalItem.h;
            const rotH = originalItem.w;
            if (checkInBounds(targetX, targetY, rotW, rotH) && !isOverlapping(targetPlacedItems, { x: targetX, y: targetY, w: rotW, h: rotH }, ignoreIdx, gap)) {
                canPlace = true;
                fitW = rotW;
                fitH = rotH;
                fitRotated = !originalItem.rotated;
            }
        }

        if (canPlace) {
            const sourceSheet = state.allSheetsResults[state.draggedItemInfo.fromSheetIndex];
            sourceSheet.placedItems.splice(state.draggedItemInfo.itemIndex, 1);

            targetSheet.placedItems.push({
                x: targetX, y: targetY,
                w: fitW, h: fitH,
                origW: originalItem.origW,
                origH: originalItem.origH,
                rotated: fitRotated
            });

            state.draggedItemInfo = null;
            updateSheetStats();
            switchSheet(state.currentActiveSheetIndex, boardW, boardH);
        } else {
            alert('放不下！該位置超出邊界、空間不足或發生重疊。');
            state.draggedItemInfo = null;
        }
    };
}

function drawSheetToCanvas(canvas, boardW, boardH, placedItems, scale) {
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e8d8c3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    placedItems.forEach((item) => {
        const x = item.x * scale;
        const y = item.y * scale;
        const w = item.w * scale;
        const h = item.h * scale;

        const key = `${item.origW}_${item.origH}`;
        const fillColor = state.globalDimColorMap[key] || '#1e40af';

        ctx.fillStyle = fillColor;
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
            const label = `${item.origW}×${item.origH}${item.rotated ? ' ↻' : ''}`;
            ctx.fillText(label, x + w / 2, y + h / 2);
        }
    });
}

window.exportToPDF = function() {
    if (state.allSheetsResults.length === 0) return;

    const exportPdfBtn = document.getElementById('exportPdfBtn');
    exportPdfBtn.disabled = true;
    exportPdfBtn.innerText = '產生 PDF 中...';

    setTimeout(() => {
        try {
            const boardW = parseFloat(document.getElementById('boardW').value);
            const boardH = parseFloat(document.getElementById('boardH').value);
            const container = document.getElementById('canvasContainer');

            container.innerHTML = '';

            state.allSheetsResults.forEach((sheet, idx) => {
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

                drawSheetTypeToCanvasCustom(canvas, boardW, boardH, sheet.placedItems, scale);
                wrapper.appendChild(canvas);
                container.appendChild(wrapper);
            });

            window.print();
            switchSheet(0, boardW, boardH);
        } finally {
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerText = '📄 匯出 PDF / 列印';
        }
    }, 50);
};

function drawSheetTypeToCanvasCustom(canvas, boardW, boardH, placedItems, scale) {
    drawSheetToCanvas(canvas, boardW, boardH, placedItems, scale);
}
