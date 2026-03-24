const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function createCleanSheet() {
    const img = await Jimp.read(path.resolve('../stencil.png'));
    const width = img.bitmap.width;
    const height = img.bitmap.height;

    // Redetect segments to be sure
    const rowDensity = new Array(height).fill(0);
    img.scan(0, 0, width, height, function(x, y, idx) {
        let a = this.bitmap.data[idx + 3];
        let r = this.bitmap.data[idx + 0];
        if (a > 50 && r < 200) rowDensity[y]++;
    });

    const rowBounds = [];
    let inRow = false;
    let startY = 0;
    for (let y = 0; y < height; y++) {
        if (rowDensity[y] > 5) {
            if (!inRow) { startY = y; inRow = true; }
        } else if (inRow) {
            rowBounds.push({ minY: Math.max(0, startY - 2), maxY: Math.min(height, y + 2) });
            inRow = false;
        }
    }
    if (inRow) rowBounds.push({ minY: startY, maxY: height });

    const segments = [];
    for (let r = 0; r < rowBounds.length; r++) {
        const rB = rowBounds[r];
        const colDensity = new Array(width).fill(0);
        img.scan(0, rB.minY, width, rB.maxY - rB.minY, function(x, y, idx) {
            let a = this.bitmap.data[idx + 3];
            let r = this.bitmap.data[idx + 0];
            if (a > 50 && r < 200) colDensity[x]++;
        });

        let inSeg = false;
        let startX = 0;
        for (let x = 0; x < width; x++) {
            if (colDensity[x] > 1) {
                if (!inSeg) { startX = x; inSeg = true; }
            } else if (inSeg) {
                if (x - startX > 2) segments.push({ r, start: startX, end: x - 1, minY: rB.minY, maxY: rB.maxY });
                inSeg = false;
            }
        }
    }

    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const itemWidth = 150;
    const itemHeight = 150;
    const cols = 8;
    const rows = Math.ceil(segments.length / cols);
    const sheet = new Jimp(cols * itemWidth, rows * itemHeight, 0xFFFFFFFF);

    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const x = (i % cols) * itemWidth;
        const y = Math.floor(i / cols) * itemHeight;

        // Refine vertical bounds
        let t = -1, b = -1;
        for (let py = s.minY; py < s.maxY; py++) {
            let has = false;
            img.scan(s.start, py, s.end - s.start + 1, 1, function(sx, sy, idx) {
                if (this.bitmap.data[idx + 3] > 50 && this.bitmap.data[idx + 0] < 200) has = true;
            });
            if (has) { if (t === -1) t = py; b = py; }
        }

        if (t !== -1) {
            const crop = img.clone().crop(s.start, t, s.end - s.start + 1, b - t + 1);
            crop.scaleToFit(itemWidth - 20, itemHeight - 40);
            sheet.composite(crop, x + 10, y + 30);
            sheet.print(font, x + 10, y + 5, `Idx: ${i}`);
        }
    }

    await sheet.write('clean_sheet.png');
    console.log(`Saved clean_sheet.png with ${segments.length} segments.`);
}

createCleanSheet();
