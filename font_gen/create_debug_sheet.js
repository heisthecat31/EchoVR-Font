const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function createDebugSheet() {
    const imgPath = path.resolve('../stencil.png');
    console.log(`Loading image from: ${imgPath}`);
    const img = await Jimp.read(imgPath);
    const width = img.bitmap.width;
    const height = img.bitmap.height;

    // 1. Find Rows dynamically
    const rowDensity = new Array(height).fill(0);
    img.scan(0, 0, width, height, function(x, y, idx) {
        let a = this.bitmap.data[idx + 3];
        let r = this.bitmap.data[idx + 0];
        if (a > 50 && r < 200) {
            rowDensity[y]++;
        }
    });

    const rowBounds = [];
    let inRow = false;
    let startY = 0;
    for (let y = 0; y < height; y++) {
        if (rowDensity[y] > 5) {
            if (!inRow) {
                startY = y;
                inRow = true;
            }
        } else {
            if (inRow) {
                rowBounds.push({ minY: Math.max(0, startY - 5), maxY: Math.min(height, y + 5) });
                inRow = false;
            }
        }
    }
    if (inRow) rowBounds.push({ minY: Math.max(0, startY - 5), maxY: height });

    console.log(`Found ${rowBounds.length} rows.`);

    const segments = [];
    for (let r = 0; r < rowBounds.length; r++) {
        const colDensity = new Array(width).fill(0);
        const minY = rowBounds[r].minY;
        const maxY = rowBounds[r].maxY;
        
        img.scan(0, minY, width, maxY - minY, function(x, y, idx) {
            let red = this.bitmap.data[idx + 0];
            let green = this.bitmap.data[idx + 1];
            let blue = this.bitmap.data[idx + 2];
            let a = this.bitmap.data[idx + 3];
            if (a > 50 && (red < 200 || green < 200 || blue < 200)) {
                colDensity[x]++;
            }
        });

        let inSeg = false;
        let startX = 0;
        for (let x = 0; x < width; x++) {
            if (colDensity[x] > 1) {
                if (!inSeg) {
                    startX = x;
                    inSeg = true;
                }
            } else {
                if (inSeg) {
                    if (x - startX > 2) {
                        segments.push({ row: r, start: startX, end: x - 1, minY, maxY });
                    }
                    inSeg = false;
                }
            }
        }
        if (inSeg) {
            segments.push({ row: r, start: startX, end: width - 1, minY, maxY });
        }
    }

    console.log(`Found ${segments.length} segments.`);

    const itemWidth = 250;
    const itemHeight = 250;
    const cols = 6;
    const rows = Math.ceil(segments.length / cols);
    const sheet = new Jimp(cols * itemWidth, rows * itemHeight, 0xFFFFFFFF);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const x = (i % cols) * itemWidth;
        const y = Math.floor(i / cols) * itemHeight;

        // Refine vertical bounds within row
        let tB = -1;
        let bB = -1;
        for (let py = s.minY; py < s.maxY; py++) {
            let hasPixel = false;
            img.scan(s.start, py, s.end - s.start + 1, 1, function(sx, sy, idx) {
                if (this.bitmap.data[idx + 3] > 50 && this.bitmap.data[idx + 0] < 200) {
                    hasPixel = true;
                }
            });
            if (hasPixel) {
                if (tB === -1) tB = py;
                bB = py;
            }
        }

        if (tB !== -1) {
            const crop = img.clone().crop(s.start, tB, s.end - s.start + 1, bB - tB + 1);
            crop.scaleToFit(itemWidth - 40, itemHeight - 60);
            sheet.composite(crop, x + 20, y + 40);
            sheet.print(font, x + 10, y + 5, `Idx: ${i} (Row ${s.row})`);
            sheet.print(font, x + 10, y + 220, `W:${s.end - s.start + 1} H:${bB - tB + 1}`);
        }
    }

    const outPath = path.resolve('./debug_segments.png');
    await sheet.write(outPath);
    console.log(`Saved debug sheet to: ${outPath}`);
}

createDebugSheet().catch(console.error);
