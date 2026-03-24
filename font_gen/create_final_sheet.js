const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function createFinalSheet() {
    const bounds = JSON.parse(fs.readFileSync('letter_bounds.json', 'utf8'));
    const outDir = path.resolve('./out');
    
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const itemWidth = 150;
    const itemHeight = 150;
    const cols = 6;
    const rows = Math.ceil(bounds.length / cols);
    const sheet = new Jimp(cols * itemWidth, rows * itemHeight, 0xFFFFFFFF);
    
    for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        const letter = b.letter;
        const imgFile = path.join(outDir, `${letter}.png`);
        
        const x = (i % cols) * itemWidth;
        const y = Math.floor(i / cols) * itemHeight;
        
        if (fs.existsSync(imgFile)) {
            const crop = await Jimp.read(imgFile);
            crop.scaleToFit(itemWidth - 20, itemHeight - 40);
            sheet.composite(crop, x + 10, y + 30);
            sheet.print(font, x + 10, y + 5, `Char: ${letter}`);
        }
    }
    
    await sheet.write('final_verification_sheet.png');
    console.log("Final verification sheet created: final_verification_sheet.png");
}

createFinalSheet().catch(console.error);
