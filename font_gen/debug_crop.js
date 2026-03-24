const Jimp = require('jimp');
const path = require('path');

const imgPath = path.resolve('../stencil.png');

async function analyzeImage() {
  const img = await Jimp.read(imgPath);
  const width = img.bitmap.width;
  const height = img.bitmap.height;
  
  console.log(`Image: ${width}x${height}`);
  
  // Find non-transparent / non-white rows and columns
  const colDensity = new Array(width).fill(0);
  const rowDensity = new Array(height).fill(0);

  img.scan(0, 0, width, height, function(x, y, idx) {
    let r = this.bitmap.data[idx + 0];
    let g = this.bitmap.data[idx + 1];
    let b = this.bitmap.data[idx + 2];
    let a = this.bitmap.data[idx + 3];

    // Assuming text is non-white and opaque. 
    // Let's count "dark" or "red" pixels
    if (a > 50 && (r < 200 || g < 200 || b < 200)) {
       colDensity[x]++;
       rowDensity[y]++;
    }
  });

  // Find boundaries
  let boundariesX = [];
  let inContent = false;
  for (let x = 0; x < width; x++) {
    if (colDensity[x] > 10) {
      if (!inContent) {
        boundariesX.push(`Start X: ${x}`);
        inContent = true;
      }
    } else {
      if (inContent) {
        boundariesX.push(`End X: ${x}`);
        inContent = false;
      }
    }
  }

  let boundariesY = [];
  inContent = false;
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] > 10) {
      if (!inContent) {
        boundariesY.push(`Start Y: ${y}`);
        inContent = true;
      }
    } else {
      if (inContent) {
        boundariesY.push(`End Y: ${y}`);
        inContent = false;
      }
    }
  }

  console.log("X boundaries limit (first 10):", boundariesX.slice(0, 10).join(", "));
  console.log("X boundaries limit count:", boundariesX.length / 2);
  console.log("Y boundaries limit:", boundariesY.join(", "));
}

analyzeImage().catch(console.error);
