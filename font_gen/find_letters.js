const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const imgPath = path.resolve('../stencil.png');

async function findLetters() {
  const img = await Jimp.read(imgPath);
  const width = img.bitmap.width;
  const height = img.bitmap.height;
  
  console.log(`Image dimensions: ${width}x${height}`);

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
        rowBounds.push({ minY: Math.max(0, startY - 10), maxY: Math.min(height, y + 10) });
        inRow = false;
      }
    }
  }
  if (inRow) rowBounds.push({ minY: Math.max(0, startY - 10), maxY: height });

  console.log(`Found ${rowBounds.length} rows.`);

  const segments = [];
  for (let r = 0; r < rowBounds.length; r++) {
    const colDensity = new Array(width).fill(0);
    const minY = rowBounds[r].minY;
    const maxY = rowBounds[r].maxY;
    
    img.scan(0, minY, width, maxY - minY, function(x, y, idx) {
      let r = this.bitmap.data[idx + 0];
      let g = this.bitmap.data[idx + 1];
      let b = this.bitmap.data[idx + 2];
      let a = this.bitmap.data[idx + 3];
      
      if (a > 50 && (r < 200 || g < 200 || b < 200)) {
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
            segments.push({ start: startX, end: x - 1, minY, maxY });
          }
          inSeg = false;
        }
      }
    }
    if (inSeg) {
      segments.push({ start: startX, end: width - 1, minY, maxY });
    }
  }

  console.log(`Found ${segments.length} raw segments.`);

  // Manual mapping based on debug_segments.png analysis
  // Format: { char: [segmentId1, segmentId2, ...] }
  const mapping = {
    'A': [0], 'B': [1], 'C': [2], 'D': [3, 4], 'E': [5], 'F': [6], 'G': [7],
    'H': [8, 9], 'I': [10], 'J': [11], 'K': [12, 13], 'L': [14], 'M': [15],
    'N': [16], 'O': [17], 'P': [18], 'Q': [19], 'R': [20], 'S': [21], 'T': [22],
    'U': [23, 24], 'V': [25], 'W': [26], 'X': [27], 'Y': [28], 'Z': [29],
    '0': [30], '1': [31], '2': [32], '3': [33], '4': [34], '5': [35], '6': [36], '7': [37],
    '8': [38, 39], '9': [40]
  };

  const allLetters = [];

  for (const letter in mapping) {
    const segIndices = mapping[letter];
    const segmentGroup = segIndices.map(idx => segments[idx]).filter(s => !!s);
    
    if (segmentGroup.length === 0) continue;

    // Combine horizontal bounds
    const startX = Math.min(...segmentGroup.map(s => s.start));
    const endX = Math.max(...segmentGroup.map(s => s.end));
    // Vertical bounds - use the union to be safe, then refine
    const initialMinY = Math.min(...segmentGroup.map(s => s.minY));
    const initialMaxY = Math.max(...segmentGroup.map(s => s.maxY));

    let tBoundary = -1;
    let bBoundary = -1;

    // Refine vertical bounds, be careful to ignore thin artifact lines
    for (let y = initialMinY; y < initialMaxY; y++) {
        let density = 0;
        img.scan(startX, y, endX - startX + 1, 1, function(sx, sy, idx) {
            if (this.bitmap.data[idx + 3] > 50 && this.bitmap.data[idx + 0] < 200) {
                density++;
            }
        });

        // Ignore rows with very low density (likely artifact or noise)
        // For merged segments, we might need a slightly higher threshold if noise is present
        if (density > 2) { 
            if (tBoundary === -1) tBoundary = y;
            bBoundary = y;
        }
    }

    if (tBoundary !== -1) {
        allLetters.push({
            letter,
            start: startX,
            end: endX,
            minY: tBoundary,
            maxY: bBoundary
        });
    }
  }

  fs.writeFileSync('letter_bounds.json', JSON.stringify(allLetters, null, 2));
  console.log(`Successfully extracted ${allLetters.length} bounds with manual mapping.`);
}

findLetters().catch(console.error);
