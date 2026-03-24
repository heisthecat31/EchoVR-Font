const Jimp = require('jimp');
const path = require('path');

async function check() {
    const img = await Jimp.read(path.resolve('../stencil.png'));
    console.log(`Dimensions: ${img.bitmap.width}x${img.bitmap.height}`);
}
check();
