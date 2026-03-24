const Jimp = require('jimp');
const path = require('path');

const imgPath = path.resolve('../stencil.png');

async function analyze() {
  const img = await Jimp.read(imgPath);
  const width = img.bitmap.width;
  const height = img.bitmap.height;
  
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
        rowBounds.push({ minY: Math.max(0, startY - 10), maxY: Math.min(height, y + 10) });
        inRow = false;
      }
    }
  }
  if (inRow) rowBounds.push({ minY: Math.max(0, startY - 10), maxY: height });

  const segments = [];
  for (let r = 0; r < rowBounds.length; r++) {
    const colDensity = new Array(width).fill(0);
    const minY = rowBounds[r].minY;
    const maxY = rowBounds[r].maxY;
    
    img.scan(0, minY, width, maxY - minY, function(x, y, idx) {
      if (this.bitmap.data[idx + 3] > 50 && this.bitmap.data[idx + 0] < 200) {
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
            segments.push({ start: startX, end: x - 1, minY, maxY, row: r });
          }
          inSeg = false;
        }
      }
    }
  }

  segments.forEach((s, i) => {
    console.log(`Idx ${i}: Row ${s.row}, X: ${s.start}-${s.end} (W: ${s.end - s.start + 1})`);
  });
}

analyze().catch(console.error);
