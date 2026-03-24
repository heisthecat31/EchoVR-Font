const fs = require('fs');
const path = require('path');
const sax = require('sax');

const svgDir = path.resolve('./out/svg');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

async function validate(file) {
    return new Promise((resolve) => {
        const fullPath = path.join(svgDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const parser = sax.parser(true);
        let hasError = false;

        parser.onerror = (e) => {
            console.error(`Error in ${file}: ${e.message}`);
            hasError = true;
            resolve(false);
        };
        parser.onend = () => {
            if (!hasError) resolve(true);
        };
        parser.write(content).close();
    });
}

async function run() {
    for (let file of files) {
        const ok = await validate(file);
        if (ok) {
            // console.log(`${file} is OK`);
        } else {
            console.log(`${file} is BAD`);
        }
    }
}
run();
