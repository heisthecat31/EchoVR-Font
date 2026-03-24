const Jimp = require('jimp');
const path = require('path');

async function checkLayout() {
    const img = await Jimp.read(path.resolve('../stencil.png'));
    const width = img.bitmap.width;
    const height = img.bitmap.height;
    
    console.log(`Dimensions: ${width}x${height}`);
    
    // Vertical density (to find rows)
    const rowDensity = new Array(height).fill(0);
    img.scan(0, 0, width, height, function(x, y, idx) {
        let a = this.bitmap.data[idx + 3];
        let r = this.bitmap.data[idx + 0];
        if (a > 50 && r < 200) {
            rowDensity[y]++;
        }
    });
    
    let inRow = false;
    let rows = [];
    let startY = 0;
    for (let y = 0; y < height; y++) {
        if (rowDensity[y] > 5) { // Threshold
            if (!inRow) {
                startY = y;
                inRow = true;
            }
        } else {
            if (inRow) {
                rows.push({ start: startY, end: y - 1 });
                inRow = false;
            }
        }
    }
    if (inRow) rows.push({ start: startY, end: height - 1 });
    
    console.log("Rows found:", rows);
    
    // Horizontal density for each row
    rows.forEach((row, i) => {
        let colDensity = new Array(width).fill(0);
        img.scan(0, row.start, width, row.end - row.start + 1, function(x, y, idx) {
            let a = this.bitmap.data[idx + 3];
            let r = this.bitmap.data[idx + 0];
            if (a > 50 && r < 200) {
                colDensity[x]++;
            }
        });
        
        let inChar = false;
        let charCount = 0;
        for (let x = 0; x < width; x++) {
            if (colDensity[x] > 2) {
                if (!inChar) {
                    charCount++;
                    inChar = true;
                }
            } else {
                inChar = false;
            }
        }
        console.log(`Row ${i}: ${charCount} potential characters`);
    });
}
checkLayout();
