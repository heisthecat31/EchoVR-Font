const Jimp = require('jimp');
const path = require('path');

async function testColors() {
    console.log("Loading stencil...");
    const img = await Jimp.read(path.resolve('../stencil.png'));
    
    let darkCount = 0;
    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;

    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
        let r = this.bitmap.data[idx + 0];
        let g = this.bitmap.data[idx + 1];
        let b = this.bitmap.data[idx + 2];
        let a = this.bitmap.data[idx + 3];

        if (a > 50 && (r < 200 || g < 200 || b < 200)) {
            darkCount++;
            if (r < minR) minR = r;
            if (g < minG) minG = g;
            if (b < minB) minB = b;
            
            if (r > maxR) maxR = r;
            if (g > maxG) maxG = g;
            if (b > maxB) maxB = b;
            
            if (darkCount === 1) {
                 console.log(`First dark pixel at ${x}, ${y}: R:${r} G:${g} B:${b}`);
            }
        }
    });
    
    console.log(`Found ${darkCount} dark pixels. Min: RGB(${minR},${minG},${minB}) Max: RGB(${maxR},${maxG},${maxB})`);
}
testColors().catch(console.error);
