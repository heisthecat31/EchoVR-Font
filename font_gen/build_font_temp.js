const potrace = require('potrace');
const fs = require('fs');
const path = require('path');
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');

const outDir = path.resolve('./out');

async function traceImage(file) {
  return new Promise((resolve, reject) => {
    potrace.trace(file, {
      color: 'black',
      background: 'white',
      optTolerance: 0.4, // higher value for more simplification/smoothing
      turdSize: 50 // remove larger noise chunks (previous was 20)
    }, (err, svg) => {
      if (err) return reject(err);
      resolve(svg);
    });
  });
}

async function build() {
  console.log("Tracing images...");
  const svgDir = path.join(outDir, 'svg');
  if (!fs.existsSync(svgDir)) {
    fs.mkdirSync(svgDir);
  }

  const boundsPath = path.resolve('./letter_bounds.json');
  const boundsData = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
  const chars = boundsData.map(b => b.letter);

  for (let letter of chars) {
    let imgFile = path.join(outDir, `${letter}.png`);
    let svgFile = path.join(svgDir, `${letter}.svg`);
    
    if (fs.existsSync(imgFile)) {
      let svg = await traceImage(imgFile);
      
      // Simplify SVG: remove the white background rect that potrace adds
      svg = svg.replace(/<rect [^>]*fill="white"[^>]*\/>/g, '');
      
      fs.writeFileSync(svgFile, svg);
    }
  }

  console.log("Building SVG font...");
  const svgFontPath = path.join(outDir, 'EchoStencil.svg');
  
  await new Promise((resolve, reject) => {
    const fontStream = new SVGIcons2SVGFontStream({
      fontName: 'EchoStencil',
      normalize: true,
      fontHeight: 1000
    });

    fontStream.pipe(fs.createWriteStream(svgFontPath))
      .on('finish', () => resolve())
      .on('error', (err) => reject(err));

    chars.forEach((letter) => {
      let svgFile = path.join(svgDir, `${letter}.svg`);
      console.log(`Adding ${letter} to font stream...`);
      const glyph = fs.createReadStream(svgFile);
      
      // Map to both UPPERCASE and lowercase (and numbers as is)
      let unicode = [letter];
      if (/[A-Z]/.test(letter)) {
          unicode.push(letter.toLowerCase());
      }
      
      glyph.metadata = {
        unicode: unicode,
        name: letter
      };
      
      glyph.on('error', (err) => {
        console.error(`Error reading ${letter}.svg:`, err);
      });

      fontStream.write(glyph);
    });

    fontStream.end();
  });

  console.log("Converting to TTF...");
  const ttfPath = path.join(outDir, 'EchoStencil_Fixed.ttf');
  const ttfPathDesktop = path.resolve('../EchoStencil.ttf');
  
  let svgFontContent = fs.readFileSync(svgFontPath, 'utf8');
  let ttf = svg2ttf(svgFontContent, {
    familyname: 'EchoStencil',
    copyright: 'Echo VR Stencil',
    description: 'Echo VR Stencil Font'
  });
  
  fs.writeFileSync(ttfPath, Buffer.from(ttf.buffer));
  fs.writeFileSync(ttfPathDesktop, Buffer.from(ttf.buffer));
  
  console.log("Done! Font saved to: " + ttfPathDesktop);
}

build().catch(console.error);
