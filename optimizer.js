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

        if (overlapX && overlapY) {
            return true;
        }
    }
    return false;
}

export function splitFreeRectSaw(freeRects, freeRect, usedW, usedH, gap) {
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
