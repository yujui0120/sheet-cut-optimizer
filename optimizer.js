export function isOverlapping(placedItems, rectToCheck, ignoreIndex = -1, gap = 0) {
    for (let i = 0; i < placedItems.length; i++) {
        if (i === ignoreIndex) continue;
        const placed = placedItems[i];
        const r1Left = rectToCheck.x;
        const r1Right = rectToCheck.x + rectToCheck.w;
        const r1Top = rectToCheck.y;
        const r1Bottom = rectToCheck.y + rectToCheck.h;
        const r2Left = placed.x;
        const r2Right = placed.x + placed.w;
        const r2Top = placed.y;
        const r2Bottom = placed.y + placed.h;
        const overlapX = (r1Left < r2Right + gap) && (r1Right + gap > r2Left);
        const overlapY = (r1Top < r2Bottom + gap) && (r1Bottom + gap > r2Top);
        if (overlapX && overlapY) return true;
    }
    return false;
}

export function optimizeCNC(boardW, boardH, gap, allowRotation, unplacedItems) {
    let allSheetsResults = [];
    let totalPerimeter = 0;
    let globalDimColorMap = {};
    let colorIndex = 0;
    const colors = ['#1e40af', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#9333ea', '#059669', '#db2777', '#ca8a04', '#0d9488', '#7c3aed'];

    unplacedItems.sort((a, b) => b.area - a.area);

    while (unplacedItems.length > 0) {
        let freeRects = [{ x: 0, y: 0, w: boardW, h: boardH }];
        let placedInThisSheet = [];
        let remainingItems = [];
        let sheetArea = 0;

        for (let item of unplacedItems) {
            let bestScore = Infinity;
            let bestFit = null;

            for (let i = 0; i < freeRects.length; i++) {
                let rect = freeRects[i];

                if (item.w <= rect.w && item.h <= rect.h) {
                    let leftoverW = rect.w - item.w;
                    let leftoverH = rect.h - item.h;
                    let score = Math.min(leftoverW, leftoverH);
                    if (score < bestScore) {
                        bestScore = score;
                        bestFit = { rectIdx: i, x: rect.x, y: rect.y, w: item.w, h: item.h, rotated: false };
                    }
                }

                if (allowRotation && item.h <= rect.w && item.w <= rect.h) {
                    let leftoverW = rect.w - item.h;
                    let leftoverH = rect.h - item.w;
                    let score = Math.min(leftoverW, leftoverH);
                    if (score < bestScore) {
                        bestScore = score;
                        bestFit = { rectIdx: i, x: rect.x, y: rect.y, w: item.h, h: item.w, rotated: true };
                    }
                }
            }

            if (bestFit) {
                const key = `${item.w}_${item.h}`;
                if (!globalDimColorMap[key]) {
                    globalDimColorMap[key] = colors[colorIndex % colors.length];
                    colorIndex++;
                }

                placedInThisSheet.push({
                    x: bestFit.x,
                    y: bestFit.y,
                    w: bestFit.w,
                    h: bestFit.h,
                    origW: item.w,
                    origH: item.h,
                    rotated: bestFit.rotated
                });

                sheetArea += item.area;
                totalPerimeter += 2 * (item.w + item.h);

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
                remainingItems.push(item);
            }
        }

        if (placedInThisSheet.length === 0) break;

        allSheetsResults.push({
            placedItems: placedInThisSheet,
            usage: ((sheetArea / (boardW * boardH)) * 100).toFixed(1)
        });

        unplacedItems = remainingItems;
    }

    return { allSheetsResults, totalPerimeter, globalDimColorMap };
}

export function optimizeSaw(boardW, boardH, gap, allowRotation, unplacedItems) {
    let allSheetsResults = [];
    let totalPerimeter = 0;
    let globalDimColorMap = {};
    let colorIndex = 0;
    const colors = ['#1e40af', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#9333ea', '#059669', '#db2777', '#ca8a04', '#0d9488', '#7c3aed'];

    unplacedItems.sort((a, b) => b.area - a.area);

    while (unplacedItems.length > 0) {
        let freeRects = [{ x: 0, y: 0, w: boardW, h: boardH }];
        let placedInThisSheet = [];
        let sheetArea = 0;
        let i = 0;

        while (i < unplacedItems.length) {
            let item = unplacedItems[i];
            let placed = false;

            for (let r = 0; r < freeRects.length; r++) {
                let freeRect = freeRects[r];

                if (item.w <= freeRect.w && item.h <= freeRect.h && !isOverlapping(placedInThisSheet, { x: freeRect.x, y: freeRect.y, w: item.w, h: item.h }, -1, gap)) {
                    const key = `${item.w}_${item.h}`;
                    if (!globalDimColorMap[key]) {
                        globalDimColorMap[key] = colors[colorIndex % colors.length];
                        colorIndex++;
                    }

                    placedInThisSheet.push({
                        x: freeRect.x,
                        y: freeRect.y,
                        w: item.w,
                        h: item.h,
                        origW: item.w,
                        origH: item.h,
                        rotated: false
                    });

                    sheetArea += item.area;
                    totalPerimeter += 2 * (item.w + item.h);

                    freeRects = splitGuillotine(freeRects, freeRect, item.w, item.h, gap);
                    placed = true;
                    break;
                }

                if (allowRotation) {
                    if (item.h <= freeRect.w && item.w <= freeRect.h && !isOverlapping(placedInThisSheet, { x: freeRect.x, y: freeRect.y, w: item.h, h: item.w }, -1, gap)) {
                        const key = `${item.w}_${item.h}`;
                        if (!globalDimColorMap[key]) {
                            globalDimColorMap[key] = colors[colorIndex % colors.length];
                            colorIndex++;
                        }

                        placedInThisSheet.push({
                            x: freeRect.x,
                            y: freeRect.y,
                            w: item.h,
                            h: item.w,
                            origW: item.w,
                            origH: item.h,
                            rotated: true
                        });

                        sheetArea += item.area;
                        totalPerimeter += 2 * (item.w + item.h);

                        freeRects = splitGuillotine(freeRects, freeRect, item.h, item.w, gap);
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

        allSheetsResults.push({
            placedItems: placedInThisSheet,
            usage: ((sheetArea / (boardW * boardH)) * 100).toFixed(1)
        });
    }

    return { allSheetsResults, totalPerimeter, globalDimColorMap };
}

function splitGuillotine(freeRects, freeRect, usedW, usedH, gap) {
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
    if (idx !== -1) freeRects.splice(idx, 1);
    return freeRects.concat(newFreeRects);
}
