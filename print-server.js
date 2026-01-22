const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('❌ fetch not available. Use Node.js 18+ or install node-fetch');
    process.exit(1);
  }
}

const DEBUG_MODE = false;

const SLOW_PRINT_MODE = 'slow';

const SLOW_PRINT_DELAYS = {
  'off': 0,
  'fast': 50,
  'medium': 150,
  'slow': 300
};

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

const ENABLE_LOGO = true;
const LOGO_MAX_WIDTH = 512;
const LOGO_PATH = path.join(__dirname, 'public', 'Strava_Logo.svg.png');

let jimpModule;
try {
  jimpModule = require('jimp');
} catch (e) {
  if (ENABLE_LOGO) {
    console.warn('⚠️ Jimp not installed. Logo will be skipped. Install with: npm install jimp');
  }
}

let sharpModule;
try {
  sharpModule = require('sharp');
} catch (e) {
  console.warn('⚠️ Sharp not installed. GPS route images will be skipped. Install with: npm install sharp');
}

let accessToken = null;
let tokenExpiresAt = null;

const GPS_ACTIVITY_TYPES = new Set([
  "Run", "Ride", "Walk", "Hike", "Swim",
  "VirtualRide", "VirtualRun", "TrailRun",
  "EBikeRide", "GravelRide", "MountainBikeRide",
  "Handcycle", "InlineSkate", "Kayaking", "Kitesurf",
  "NordicSki", "AlpineSki", "BackcountrySki",
  "Canoeing", "Golf", "IceSkate", "Rowing", "Sail",
  "Skateboard", "Snowboard", "Snowshoe",
  "StandUpPaddling", "Surfing", "Velomobile",
  "Windsurf", "Wheelchair"
]);

function activitySupportsGPS(activityType) {
  return GPS_ACTIVITY_TYPES.has(activityType);
}

const ESC = '\x1B';
const GS = '\x1D';
const INIT = `${ESC}@`;

const NORMAL_SIZE = `${ESC}!${String.fromCharCode(0)}`;
const DOUBLE_HEIGHT = `${ESC}!${String.fromCharCode(16)}`;
const DOUBLE_WIDTH = `${ESC}!${String.fromCharCode(32)}`;
const DOUBLE_SIZE = `${ESC}!${String.fromCharCode(48)}`;
const SMALL_SIZE = `${ESC}!${String.fromCharCode(1)}`;

const ALIGN_LEFT = `${ESC}a${String.fromCharCode(0)}`;
const ALIGN_CENTER = `${ESC}a${String.fromCharCode(1)}`;
const ALIGN_RIGHT = `${ESC}a${String.fromCharCode(2)}`;

const BOLD_ON = `${ESC}E${String.fromCharCode(1)}`;
const BOLD_OFF = `${ESC}E${String.fromCharCode(0)}`;
const FONT_A = `${ESC}M${String.fromCharCode(0)}`;

const SET_LINE_SPACING = `${ESC}3`;
const LINE_SPACING_10 = `${SET_LINE_SPACING}${String.fromCharCode(10)}`;
const RESET_LINE_SPACING = `${ESC}2`;

const FULL_CUT_N3 = `${GS}V${String.fromCharCode(66)}\x03`;

const FEED = (n = 3) => `${ESC}d${String.fromCharCode(Math.max(0, Math.min(255, n)))}`;

const SECTION_BREAK = '<<<SECTION>>>';

const LINE_WIDTH = 48;
const HEADER_WIDTH = Math.floor(LINE_WIDTH / 2);

const toUpper = (s = '') => String(s).toUpperCase();
const pad = (s = '', n) => String(s).padEnd(n, ' ');
const twoCol = (left, right, total = LINE_WIDTH) => {
  const l = String(left);
  const r = String(right);
  const space = Math.max(1, total - l.length - r.length);
  return l + ' '.repeat(space) + r;
};

const threeCol = (col1, col2, col3, widths = [8, 24, 12]) => {
  const [w1, w2, w3] = widths;
  const c1 = String(col1).padStart(w1);
  const c2 = String(col2).padEnd(w2);
  const c3 = String(col3).padStart(w3);
  return c1 + ' ' + c2 + ' ' + c3;
};

const wrapText = (text = '', width = LINE_WIDTH) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + (line ? ' ' : '') + w).length <= width) {
      line += (line ? ' ' : '') + w;
    } else {
      if (line) lines.push(line);
      if (w.length > width) {
        for (let i = 0; i < w.length; i += width) {
          lines.push(w.slice(i, i + width));
        }
        line = '';
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
};

function metersToMiles(meters) {
  return meters * 0.000621371;
}

function formatTime(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function bytesToBinaryString(byteArray) {
  let result = '';
  for (let i = 0; i < byteArray.length; i += 1) {
    result += String.fromCharCode(byteArray[i]);
  }
  return result;
}

function buildRasterImageCommand(bitmapBytesPerRow, height, rasterData, mode = 0) {
  const xL = bitmapBytesPerRow & 0xff;
  const xH = (bitmapBytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  const header = [0x1d, 0x76, 0x30, mode, xL, xH, yL, yH];
  const payload = new Uint8Array(header.length + rasterData.length);
  payload.set(header, 0);
  payload.set(rasterData, header.length);
  return bytesToBinaryString(payload);
}

async function buildLogoRasterString(imagePath, maxWidth = LOGO_MAX_WIDTH) {
  try {
    if (!jimpModule) {
      console.warn('⚠️ Jimp not available. Logo will be skipped.');
      return '';
    }
    if (!fs.existsSync(imagePath)) {
      console.warn('⚠️ Logo file not found:', imagePath);
      return '';
    }
    const JimpClass = jimpModule.Jimp || jimpModule;
    const image = await JimpClass.read(imagePath);
    const targetWidth = Math.min(maxWidth, image.bitmap.width);
    const aspectRatio = image.bitmap.height / image.bitmap.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);
    image.resize(targetWidth, targetHeight);
    image.greyscale();
    image.contrast(0.3);
    const { width, height, data } = image.bitmap;
    const bytesPerRow = Math.ceil(width / 8);
    const raster = new Uint8Array(bytesPerRow * height);
    const threshold = 0.5;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        const r = data[idx] / 255;
        const g = data[idx + 1] / 255;
        const b = data[idx + 2] / 255;
        const a = data[idx + 3] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const isBlack = (1 - lum) > threshold && a > 0.1;
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bit = 7 - (x & 7);
        if (isBlack) {
          raster[byteIndex] |= (1 << bit);
        }
      }
    }
    return buildRasterImageCommand(bytesPerRow, height, raster, 0);
  } catch (e) {
    console.warn('⚠️ Logo rendering failed:', e.message);
    return '';
  }
}

async function buildGPSRouteRasterString(route, maxWidth = 512) {
  if (!route || route.length < 2) {
    console.warn('⚠️ buildGPSRouteRasterString: Invalid route data');
    return '';
  }
  
  if (!Array.isArray(route)) {
    console.error('❌ buildGPSRouteRasterString: Route is not an array');
    return '';
  }
  
  if (!route[0] || typeof route[0].lat === 'undefined' || typeof route[0].lng === 'undefined') {
    console.error('❌ buildGPSRouteRasterString: Route points missing lat/lng');
    return '';
  }
  
  try {
    if (!sharpModule || !jimpModule) {
      console.error('❌ Sharp or Jimp not available. GPS route will be skipped.');
      return '';
    }
    
    let minLat = route[0].lat;
    let maxLat = route[0].lat;
    let minLng = route[0].lng;
    let maxLng = route[0].lng;
    
    route.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const padding = Math.max(latRange, lngRange) * 0.1;
    
    minLat -= padding;
    maxLat += padding;
    minLng -= padding;
    maxLng += padding;
    
    const svgWidth = 400;
    const svgHeight = 300;
    
    let pathData = '';
    route.forEach((point, index) => {
      const x = ((point.lng - minLng) / (maxLng - minLng)) * svgWidth;
      const y = svgHeight - ((point.lat - minLat) / (maxLat - minLat)) * svgHeight;
      pathData += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    });
    
    const svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
      <path d="${pathData}" stroke="black" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempSvgPath = path.join(tempDir, `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.svg`);
    fs.writeFileSync(tempSvgPath, svg);
    
    let pngBuffer;
    try {
      pngBuffer = await sharpModule(tempSvgPath)
        .png()
        .toBuffer();
    } catch (sharpError) {
      try {
        fs.unlinkSync(tempSvgPath);
      } catch (e) {
      }
      throw sharpError;
    }
    
    try {
      fs.unlinkSync(tempSvgPath);
    } catch (e) {
    }
    
    const JimpClass = jimpModule.Jimp || jimpModule;
    const image = await JimpClass.read(pngBuffer);
    const targetWidth = Math.min(maxWidth, image.bitmap.width);
    const aspectRatio = image.bitmap.height / image.bitmap.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);
    image.resize(targetWidth, targetHeight);
    image.greyscale();
    image.contrast(0.3);
    
    const { width, height, data } = image.bitmap;
    const bytesPerRow = Math.ceil(width / 8);
    const raster = new Uint8Array(bytesPerRow * height);
    const threshold = 0.5;
    
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        const r = data[idx] / 255;
        const g = data[idx + 1] / 255;
        const b = data[idx + 2] / 255;
        const a = data[idx + 3] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const isBlack = (1 - lum) > threshold && a > 0.1;
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bit = 7 - (x & 7);
        if (isBlack) {
          raster[byteIndex] |= (1 << bit);
        }
      }
    }
    
    return buildRasterImageCommand(bytesPerRow, height, raster, 0);
  } catch (e) {
    console.warn('⚠️ GPS route rendering failed:', e.message);
    return '';
  }
}

function buildEpsonQR(data, moduleSize = 5, ecLevel = '1') {
  const payload = Buffer.from(String(data), 'utf8').toString('binary');
  const pL = String.fromCharCode((payload.length + 3) & 0xff);
  const pH = String.fromCharCode(((payload.length + 3) >> 8) & 0xff);
  const model = `${GS}(k\x04\x00\x31\x41\x32\x00`;
  const size = `${GS}(k\x03\x00\x31\x43${String.fromCharCode(moduleSize)}`;
  const ec = `${GS}(k\x03\x00\x31\x45${ecLevel}`;
  const store = `${GS}(k${pL}${pH}\x31\x50\x30${payload}`;
  const print = `${GS}(k\x03\x00\x31\x51\x30`;
  return model + size + ec + store + print;
}

async function createAndPrintActivityReceipt(activity, route = null, photos = null) {
  try {
    const activityName = activity.name || activity.title || "Untitled Activity";
    const activityDate = activity.start_date ? new Date(activity.start_date) : new Date();
    const activityType = activity.type || "RUN";
    const distanceMiles = activity.distance ? metersToMiles(activity.distance) : 0;
    const location = activity.location_city || activity.location_country || "NEW YORK, NEW YORK";
    
    const activityUrl = `https://www.strava.com/activities/${activity.id}`;

    const lines = [];

    lines.push(
      INIT,
      ESC + '2',
      ALIGN_LEFT,
      FONT_A,
      NORMAL_SIZE,
      FEED(2)
    );

    if (ENABLE_LOGO) {
      try {
        const logoStr = await buildLogoRasterString(LOGO_PATH);
        if (logoStr) {
          lines.push(ALIGN_CENTER, logoStr, ALIGN_LEFT, '\n');
        }
      } catch (e) {
        console.warn('⚠️ Failed to add logo:', e.message);
      }
    }

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      BOLD_ON,
      toUpper(activityName) + '\n',
      BOLD_OFF,
      FEED(1)
    );

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      toUpper(location) + '\n',
      FEED(1)
    );

    const activityDateTime = activity.start_date ? new Date(activity.start_date) : new Date();
    const dateTimeStr = activityDateTime.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).toUpperCase();
    
    lines.push(
      ALIGN_CENTER,
      toUpper(dateTimeStr) + '\n',
      FEED(1)
    );

    lines.push(SECTION_BREAK);

    lines.push(ALIGN_CENTER, '-'.repeat(LINE_WIDTH) + '\n', ALIGN_LEFT, FEED(1));

    lines.push(
      BOLD_ON + toUpper(threeCol('COUNT', 'TYPE', 'NO. MILES')) + BOLD_OFF + '\n',
      FEED(1)
    );

    lines.push(
      toUpper(threeCol('1', activityType, distanceMiles.toFixed(2))) + '\n'
    );
    
    let paceStr = 'N/A';
    const movingTime = activity.moving_time || activity.elapsed_time;
    if (distanceMiles > 0 && movingTime) {
      const paceMinutes = movingTime / 60 / distanceMiles;
      const paceMin = Math.floor(paceMinutes);
      const paceSec = Math.round((paceMinutes - paceMin) * 60);
      paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')} min/mi`;
    }
    
    const heartRate = activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : 'N/A';
    const elevationGain = activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain * 3.28084)} ft` : 'N/A';
    
    const nameIndent = ' '.repeat(9);
    lines.push(
      nameIndent + toUpper(`PACE: ${paceStr}`) + '\n',
      nameIndent + toUpper(`AVG HEART RATE: ${heartRate}`) + '\n',
      nameIndent + toUpper(`ELEVATION GAIN: ${elevationGain}`) + '\n',
      FEED(1)
    );

    lines.push(ALIGN_CENTER, '-'.repeat(LINE_WIDTH) + '\n', ALIGN_LEFT, FEED(1));

    lines.push(
      BOLD_ON + toUpper(threeCol('', 'TOTAL MILES', distanceMiles.toFixed(2))) + BOLD_OFF + '\n',
      FEED(1)
    );

    lines.push(
      ALIGN_RIGHT,
      toUpper('(STRAVA TAX INCL.)') + '\n',
      ALIGN_LEFT,
      FEED(2)
    );

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      BOLD_ON,
      toUpper('RUN ROUTE') + '\n',
      BOLD_OFF,
      FEED(1)
    );
    
    if (route && Array.isArray(route) && route.length > 1) {
      try {
        const routeRaster = await buildGPSRouteRasterString(route, 512);
        if (routeRaster && routeRaster.length > 0) {
          lines.push(ALIGN_CENTER, routeRaster, ALIGN_LEFT, '\n');
        } else {
          lines.push(ALIGN_CENTER, '[Route visualization]' + '\n');
        }
      } catch (e) {
        console.error('❌ Failed to render GPS route:', e.message);
        lines.push(ALIGN_CENTER, '[Route visualization]' + '\n');
      }
    } else {
      lines.push(ALIGN_CENTER, '[Route visualization]' + '\n');
    }
    
    lines.push(FEED(2));

    lines.push(SECTION_BREAK);

    if (photos && Array.isArray(photos) && photos.length > 0) {
      lines.push(
        ALIGN_CENTER,
        BOLD_ON,
        toUpper('ACTIVITY PHOTOS') + '\n',
        BOLD_OFF,
        FEED(1)
      );
      
      const maxPhotos = Math.min(photos.length, 3);
      
      for (let i = 0; i < maxPhotos; i++) {
        const photo = photos[i];
        const photoUrl = photo.urls?.['600'] || photo.urls?.['100'] || photo.unique_id;
        
        if (photoUrl && jimpModule) {
          try {
            const response = await fetch(photoUrl);
            if (response.ok) {
              const imageBuffer = Buffer.from(await response.arrayBuffer());
              const JimpClass = jimpModule.Jimp || jimpModule;
              const image = await JimpClass.read(imageBuffer);
              const targetWidth = Math.min(400, image.bitmap.width);
              const aspectRatio = image.bitmap.height / image.bitmap.width;
              const targetHeight = Math.round(targetWidth * aspectRatio);
              image.resize(targetWidth, targetHeight);
              image.greyscale();
              image.contrast(0.2);
              
              const { width, height, data } = image.bitmap;
              const bytesPerRow = Math.ceil(width / 8);
              const raster = new Uint8Array(bytesPerRow * height);
              const threshold = 0.5;
              
              for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                  const idx = (y * width + x) * 4;
                  const r = data[idx] / 255;
                  const g = data[idx + 1] / 255;
                  const b = data[idx + 2] / 255;
                  const a = data[idx + 3] / 255;
                  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                  const isBlack = (1 - lum) > threshold && a > 0.1;
                  const byteIndex = y * bytesPerRow + (x >> 3);
                  const bit = 7 - (x & 7);
                  if (isBlack) {
                    raster[byteIndex] |= (1 << bit);
                  }
                }
              }
              
              const photoRaster = buildRasterImageCommand(bytesPerRow, height, raster, 0);
              lines.push(ALIGN_CENTER, photoRaster, ALIGN_LEFT, '\n');
              lines.push(FEED(1));
            }
          } catch (e) {
            console.error(`   ❌ Failed to process photo ${i + 1}:`, e.message);
          }
        }
      }
      
      if (photos.length > maxPhotos) {
        lines.push(
          ALIGN_CENTER,
          `(+${photos.length - maxPhotos} more photo${photos.length - maxPhotos > 1 ? 's' : ''} on Strava)\n`,
          ALIGN_LEFT
        );
      }
      
      lines.push(FEED(1));
    }

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      BOLD_ON + toUpper('SUGGESTED GRATUITY') + BOLD_OFF + '\n',
      FEED(1),
      ALIGN_LEFT,
      '          ' + toUpper('[ ] GIVE SOME KUDOS') + '\n',
      '          ' + toUpper('[ ] SHARE WITH A FRIEND') + '\n',
      '          ' + toUpper('[ ] FOLLOW & TAG @_RE_PETE') + '\n',
      FEED(2)
    );

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      toUpper('VIEW ON STRAVA') + '\n',
      FEED(1),
      buildEpsonQR(activityUrl),
      ALIGN_LEFT,
      FEED(1),
      ALIGN_CENTER,
      FEED(2)
    );

    lines.push(SECTION_BREAK);

    lines.push(
      ALIGN_CENTER,
      toUpper('<< ATHLETE COPY >>') + '\n',
      FEED(2)
    );

    lines.push(FEED(2), INIT, FULL_CUT_N3);

    const fullContent = lines.join('');
    const sections = fullContent.split(SECTION_BREAK).filter(s => s.length > 0);
    
    const printDelay = SLOW_PRINT_DELAYS[SLOW_PRINT_MODE] || 0;

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    if (DEBUG_MODE) {
      console.log('🔍 DEBUG MODE: Receipt content:');
      console.log(fullContent.replace(new RegExp(SECTION_BREAK, 'g'), ''));
      console.log(`📄 Sections: ${sections.length}, Delay: ${printDelay}ms`);
      return;
    }

    const possiblePrinters = [
      'EPSON_TM_T20III',
      'Epson_TM_T20III',
      'TM-T20III',
      'TM-T20',
      'Epson'
    ];

    let printerName = null;
    for (const name of possiblePrinters) {
      try {
        const { execSync } = require('child_process');
        execSync(`lpstat -p "${name}"`, { stdio: 'pipe' });
        printerName = name;
        console.log(`✅ Found printer: ${printerName}`);
        break;
      } catch (e) {
      }
    }

    if (!printerName) {
      console.log('🖨️ Using default printer');
    }

    if (printDelay > 0 && sections.length > 1) {
      console.log(`🐢 Slow print mode: ${SLOW_PRINT_MODE} (${printDelay}ms between ${sections.length} sections)`);
      
      const printSection = async (index) => {
        if (index >= sections.length) {
          console.log('✅ All sections printed!');
          return;
        }

        const sectionContent = sections[index];
        const filename = `section_${index}_${Date.now()}.bin`;
        const filepath = path.join(tempDir, filename);
        
        fs.writeFileSync(filepath, Buffer.from(sectionContent, 'binary'));
        
        const printCommand = printerName 
          ? `lp -d "${printerName}" -o raw "${filepath}"`
          : `lp -o raw "${filepath}"`;

        exec(printCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Section ${index + 1} print error:`, error.message);
          } else {
            console.log(`📄 Section ${index + 1}/${sections.length} sent`);
          }
          
          setTimeout(() => {
            try { fs.unlinkSync(filepath); } catch (e) {}
          }, 1000);
          
          setTimeout(() => printSection(index + 1), printDelay);
        });
      };

      printSection(0);
    } else {
      const filename = `activity_${activity.id || Date.now()}.txt`;
      const filepath = path.join(tempDir, filename);
      const cleanContent = fullContent.replace(new RegExp(SECTION_BREAK, 'g'), '');
      
      fs.writeFileSync(filepath, Buffer.from(cleanContent, 'binary'));
      console.log('📄 Activity receipt created at:', filepath);

      const printCommand = printerName 
        ? `lp -d "${printerName}" -o raw "${filepath}"`
        : `lp -o raw "${filepath}"`;

      console.log('🖨️ Executing print command:', printCommand);

      exec(printCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Print error:', error);
          console.error('❌ stderr:', stderr);
          return;
        }

        console.log('✅ Activity receipt sent!');

        setTimeout(() => {
          try {
            fs.unlinkSync(filepath);
            console.log('🧹 Temp file cleaned up');
          } catch (cleanupError) {
            console.warn('⚠️ Cleanup error:', cleanupError.message);
          }
        }, 5000);
      });
    }

  } catch (error) {
    console.error('❌ Error creating activity receipt:', error);
  }
}

const PRINT_SERVER_PORT = 3001;

function startPrintServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready', port: PRINT_SERVER_PORT }));
      return;
    }
    
    if (req.method === 'POST' && req.url === '/print') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { activity, route, photos } = data;
          
          if (!activity) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Activity data is required' }));
            return;
          }
          
          console.log(`🖨️ Print request received for: ${activity.name || activity.id}`);
          
          await createAndPrintActivityReceipt(activity, route || null, photos || null);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Print job sent' }));
        } catch (error) {
          console.error('❌ Error processing print request:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  server.listen(PRINT_SERVER_PORT, () => {
    console.log(`🖨️ Print server running on http://localhost:${PRINT_SERVER_PORT}`);
    console.log(`📡 Ready to receive print requests from web interface`);
    console.log(`   POST http://localhost:${PRINT_SERVER_PORT}/print`);
    console.log(`   GET  http://localhost:${PRINT_SERVER_PORT}/status`);
  });
  
  return server;
}

if (require.main === module) {
  console.log('🚀 Starting print server...');
  startPrintServer();
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down print server...');
    process.exit(0);
  });
}

module.exports = { 
  createAndPrintActivityReceipt, 
  startPrintServer
};

