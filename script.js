let currentUnit = 'mm';

// 頁面載入時預設填入 2 組常用的切片
window.onload = () => {
  addItemRow(800, 400, 5);
  addItemRow(1000, 500, 3);
};

// 動態新增切片項目
function addItemRow(w = '', h = '', count = 1) {
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
  
  const factor = newUnit === 'cm' ? 0.1 : 10;
  
  // 轉換底板與鋸縫
  ['boardW', 'boardH', 'gap'].forEach(id => {
    const input = document.getElementById(id);
    if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
  });

  // 轉換切片尺寸
  document.querySelectorAll('.item-w, .item-h').forEach(input => {
    if (input.value) input.value = (parseFloat(input.value) * factor).toFixed(2).replace(/\.00$/, '');
  });

  currentUnit = newUnit;
}

// 二維裝箱演算法 (MaxRects Bin Packing 簡化版)
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
  let items = [];
  const rows = document.querySelectorAll('.item-row');
  rows.forEach((row, idx) => {
    const w = parseFloat(row.querySelector('.item-w').value);
    const h = parseFloat(row.querySelector('.item-h').value);
    const count = parseInt(row.querySelector('.item-count').value) || 0;
    if (w > 0 && h > 0 && count > 0) {
      for (let i = 0; i < count; i++) {
        items.push({ id: `${idx+1}-${i+1}`, w, h, area: w * h });
      }
    }
  });

  // 優先放入較大面積的木板 (Greedy Approach)
  items.sort((a, b) => b.area - a.area);

  let freeRects = [{ x: 0, y: 0, w: boardW, h: boardH }];
  let placedItems = [];
  let totalPlacedArea = 0;

  for (let item of items) {
    let bestFit = null;
    let bestRotated = false;

    // 尋找最佳容納位置
    for (let i = 0; i < freeRects.length; i++) {
      let rect = freeRects[i];

      // 1. 不旋轉測試
      if (item.w <= rect.w && item.h <= rect.h) {
        bestFit = { rectIdx: i, x: rect.x, y: rect.y, w: item.w, h: item.h };
        bestRotated = false;
        break;
      }
      // 2. 允許旋轉 90 度測試
      if (allowRotation && item.h <= rect.w && item.w <= rect.h) {
        bestFit = { rectIdx: i, x: rect.x, y: rect.y, w: item.h, h: item.w };
        bestRotated = true;
        break;
      }
    }

    if (bestFit) {
      // 記錄放置成功
      placedItems.push({
        x: bestFit.x, y: bestFit.y,
        w: bestFit.w, h: bestFit.h,
        rotated: bestRotated
      });
      totalPlacedArea += item.area;

      // 切割剩餘空間
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
    }
  }

  // 計算統計資訊
  const totalBoardArea = boardW * boardH;
  const usage = ((totalPlacedArea / totalBoardArea) * 100).toFixed(1);

  document.getElementById('statUsage').innerText = `${usage}%`;
  document.getElementById('statSheets').innerText = placedItems.length > 0 ? 1 : 0;
  document.getElementById('statPlaced').innerText = `${placedItems.length} / ${items.length}`;

  // 繪製 Canvas 排版視覺圖
  renderCanvas(boardW, boardH, placedItems);
}

// 畫出 Canvas 木板佈局
function renderCanvas(boardW, boardH, placedItems) {
  const container = document.getElementById('canvasContainer');
  container.innerHTML = ''; // 清空預覽

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 依容器寬度動態縮放
  const maxCanvasWidth = Math.min(container.clientWidth - 30, 700);
  const scale = maxCanvasWidth / boardW;

  canvas.width = boardW * scale;
  canvas.height = boardH * scale;
  container.appendChild(canvas);

  // 1. 繪製木板底色
  ctx.fillStyle = '#e8d8c3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // 2. 繪製切片
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9c27b0'];
  
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
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // 標記尺寸標籤
    if (w > 30 && h > 15) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(10, Math.min(14, w/5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `${item.w}×${item.h}${item.rotated ? ' ↻' : ''}`;
      ctx.fillText(label, x + w / 2, y + h / 2);
    }
  });
}
