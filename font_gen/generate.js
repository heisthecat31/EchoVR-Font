const Jimp = require('jimp');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');
const SVGIcons2SVGFontStream = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');

const imgPath = path.resolve('../stencil.png');
const outDir = path.resolve('./out');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

// Ensure clean B&W image for potentiate (black = shape, white = bg)
async function processImage() {
  console.log("Loading image...");
  const img = await Jimp.read(imgPath);
  const width = img.bitmap.width;
  const height = img.bitmap.height;
  
  // Read dynamically computed letter bounds
  const boundsPath = path.resolve('./letter_bounds.json');
  let boundsData = [];
  try {
    boundsData = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
  } catch (err) {
    console.error("Could not find letter_bounds.json. Please run find_letters.js first.");
    return;
  }
  
  console.log(`Image: ${width}x${height}, Bounds count: ${boundsData.length}`);
  
  for (let i = 0; i < boundsData.length; i++) {
    let bound = boundsData[i];
    let letter = bound.letter;
    
    // Add small side paddings for the character advance width in the font
    let padding = 15;
    
    let x = Math.max(0, bound.start - padding);
    let rightX = Math.min(width - 1, bound.end + padding);
    let w = rightX - x + 1;
    
    // Add small vertical padding 
    let vPadding = 10;
    let y = Math.max(0, bound.minY - vPadding);
    let bottomY = Math.min(height - 1, bound.maxY + vPadding);
    let h = bottomY - y + 1;
    
    if (x + w > width) w = width - x;
    if (y + h > height) h = height - y;
    
    console.log(`Processing ${letter} at x:${x}, y:${y}, w:${w}, h:${h}...`);
    
    let clone = img.clone().crop(x, y, w, h);
    
    // Step 1: Convert to grayscale and boost contrast (keeps smooth gradients)
    clone.grayscale().contrast(0.5);

    // Step 2: Ensure full opacity on all pixels
    clone.scan(0, 0, clone.bitmap.width, clone.bitmap.height, function(x, y, idx) {
      this.bitmap.data[idx + 3] = 255;
    });

    // Step 3: Upscale BEFORE thresholding — bicubic preserves the smooth gradient
    // edges from the original image, producing anti-aliased contours
    clone.resize(clone.bitmap.width * 8, Jimp.AUTO, Jimp.RESIZE_BICUBIC);

    // Step 4: Gaussian blur to smooth out any remaining edge noise
    clone.blur(5);

    // Step 5: NOW apply threshold on the smooth, upscaled image
    clone.scan(0, 0, clone.bitmap.width, clone.bitmap.height, function(x, y, idx) {
      let r = this.bitmap.data[idx];
      if (r < 128) {
        // Dark → solid black (character)
        this.bitmap.data[idx] = 0;
        this.bitmap.data[idx + 1] = 0;
        this.bitmap.data[idx + 2] = 0;
      } else {
        // Light → solid white (background)
        this.bitmap.data[idx] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
      }
      this.bitmap.data[idx + 3] = 255;
    });
    
    // Step 6: Clear edges of the upscaled image (40 pixels = 5 original pixels at 8x)
    clone.scan(0, 0, clone.bitmap.width, clone.bitmap.height, function(x, y, idx) {
        if (x < 40 || x > clone.bitmap.width - 41 || y < 40 || y > clone.bitmap.height - 41) {
            this.bitmap.data[idx + 0] = 255;
            this.bitmap.data[idx + 1] = 255;
            this.bitmap.data[idx + 2] = 255;
            this.bitmap.data[idx + 3] = 255;
        }
    });

    const tmpFile = path.join(outDir, `${letter}.png`);
    await clone.write(tmpFile);
  }
}

processImage().then(() => console.log('Crop done.'));
