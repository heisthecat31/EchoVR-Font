const potrace = require('potrace');
const fs = require('fs');
const path = require('path');
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');

// Helper to reverse an SVG path string (simple M L C Z support for Potrace)
function reversePath(d) {
  const subPaths = d.split(/(?=[Mm])/).filter(p => p.trim());
  const reversedSubPaths = subPaths.map((sub, index) => {
    // We reverse holes (subpaths index > 0) to ensure opposite winding from the outer shell
    if (index === 0) return sub; 

    const commands = [];
    const re = /([MLCZmlcz])\s*([^MLCZmlcz]*)/g;
    let match;
    while ((match = re.exec(sub))) {
      commands.push({ 
        type: match[1].toUpperCase(), 
        args: match[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n)) 
      });
    }

    if (commands.length < 2) return sub;

    const pts = [];
    
    commands.forEach(cmd => {
      if (cmd.type === 'M' || cmd.type === 'L') {
        pts.push({ x: cmd.args[0], y: cmd.args[1], type: cmd.type });
      } else if (cmd.type === 'C') {
        pts.push({ 
            x: cmd.args[4], 
            y: cmd.args[5], 
            type: 'C', 
            c1: [cmd.args[0], cmd.args[1]], 
            c2: [cmd.args[2], cmd.args[3]] 
        });
      }
    });

    if (pts.length < 2) return sub;

    const reversed = [];
    const last = pts[pts.length - 1];
    reversed.push(`M ${last.x} ${last.y}`);

    for (let i = pts.length - 1; i > 0; i--) {
      const p = pts[i];
      const prev = pts[i-1];
      if (p.type === 'C') {
        // To reverse a cubic Bézier, swap control points and use the previous point as target
        reversed.push(`C ${p.c2[0]} ${p.c2[1]} ${p.c1[0]} ${p.c1[1]} ${prev.x} ${prev.y}`);
      } else {
        reversed.push(`L ${prev.x} ${prev.y}`);
      }
    }
    reversed.push('Z');
    return reversed.join(' ');
  });

  return reversedSubPaths.join(' ');
}

const outDir = path.resolve('./out');

async function traceImage(file) {
  return new Promise((resolve, reject) => {
    potrace.trace(file, {
      color: 'black',
      background: 'white',
      optTolerance: 0.4,
      turdSize: 50 
    }, (err, svg) => {
      if (err) return reject(err);
      
      // Post-process SVG to fix winding order for TTF
      const dMatch = svg.match(/d="([^"]+)"/);
      if (dMatch) {
        const originalD = dMatch[1];
        const fixedD = reversePath(originalD);
        svg = svg.replace(`d="${originalD}"`, `d="${fixedD}"`);
      }
      
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
  const ttfPath = path.join(outDir, 'EchoStencil.ttf');
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
