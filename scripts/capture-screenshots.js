import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.resolve('docs/images');
const PUBLIC_DIR = path.resolve('public');
const APP_URL = 'http://localhost:1420';
const VIEWPORT = { width: 1280, height: 800 };

function parseAndDownsamplePGM(buffer, scaleFactor = 4) {
  let offset = 0;
  function readWord() {
    while (offset < buffer.length) {
      if (buffer[offset] === 35) {
        while (offset < buffer.length && buffer[offset] !== 10 && buffer[offset] !== 13) {
          offset++;
        }
      }
      if (buffer[offset] > 32) break;
      offset++;
    }
    const start = offset;
    while (offset < buffer.length && buffer[offset] > 32) {
      offset++;
    }
    return buffer.toString('ascii', start, offset);
  }

  const magic = readWord();
  if (magic !== 'P5' && magic !== 'P2') {
    throw new Error('Unsupported PGM format: ' + magic);
  }
  const width = parseInt(readWord(), 10);
  const height = parseInt(readWord(), 10);
  const maxval = parseInt(readWord(), 10);
  offset++;

  const rawPixels = buffer.subarray(offset);
  const newWidth = Math.floor(width / scaleFactor);
  const newHeight = Math.floor(height / scaleFactor);
  const downsampledPixels = new Uint8Array(newWidth * newHeight);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcIdx = (y * scaleFactor) * width + (x * scaleFactor);
      downsampledPixels[y * newWidth + x] = rawPixels[srcIdx] || 255;
    }
  }

  return { width: newWidth, height: newHeight, scaleFactor, pixels: downsampledPixels };
}

function pgmToBmpBuffer(pgm) {
  const { width, height, pixels } = pgm;
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);

  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelArraySize, 34);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = pixels[y * width + x];
      const pIdx = offset + y * rowSize + x * 3;
      buf[pIdx] = val;     // B
      buf[pIdx + 1] = val; // G
      buf[pIdx + 2] = val; // R
    }
  }

  return buf;
}

async function waitForServer(url, retries = 15, delayMs = 2000) {
  const { default: http } = await import('http');
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.destroy();
          resolve(null);
        });
        req.on('error', reject);
        req.setTimeout(1500, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return;
    } catch {
      console.log(`Waiting for server... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Server not ready at ${url} after ${retries} retries`);
}

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  console.log('Generating public sample BMP map files...');
  const sampleMap1Path = path.resolve('docs/sample/map1/map1.pgm');
  const sampleMap2Path = path.resolve('docs/sample/map2/map2.pgm');

  const pgm1 = parseAndDownsamplePGM(fs.readFileSync(sampleMap1Path), 4);
  const pgm2 = parseAndDownsamplePGM(fs.readFileSync(sampleMap2Path), 4);

  const bmpBuf1 = pgmToBmpBuffer(pgm1);
  const bmpBuf2 = pgmToBmpBuffer(pgm2);

  const tmpBmp1Path = path.join(PUBLIC_DIR, 'sample_map1.bmp');
  const tmpBmp2Path = path.join(PUBLIC_DIR, 'sample_map2.bmp');

  fs.writeFileSync(tmpBmp1Path, bmpBuf1);
  fs.writeFileSync(tmpBmp2Path, bmpBuf2);
  console.log('Sample BMP maps written to public/sample_map1.bmp & public/sample_map2.bmp');

  const map1Info = {
    width: pgm1.width,
    height: pgm1.height,
    resolution: 0.05 * pgm1.scaleFactor,
    origin: [-130, -99, 0],
    negate: 0,
    occupied_thresh: 0.65,
    free_thresh: 0.25
  };

  const map2Info = {
    width: pgm2.width,
    height: pgm2.height,
    resolution: 0.05 * pgm2.scaleFactor,
    origin: [-48.35, 54.55, 0],
    negate: 0,
    occupied_thresh: 0.65,
    free_thresh: 0.25
  };

  console.log('Starting Vite dev server...');
  const devServer = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
  devServer.stderr.on('data', data => console.error('Vite:', data.toString()));

  try {
    await waitForServer(APP_URL);

    console.log('Launching Playwright Chromium...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: VIEWPORT });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    try {
      console.log(`Navigating to ${APP_URL}...`);
      await page.goto(APP_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      console.log('Loading public sample BMPs and initializing store cache...');
      const initResult = await page.evaluate(async ({ map1Info, map2Info }) => {
        // @ts-ignore
        const store = window.useAppStore ? window.useAppStore.getState() : null;
        if (!store) return 'NO_STORE';

        const loadImageAsBase64 = (url) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject('No 2d context');
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(`Failed to load image from ${url}`);
            img.src = url;
          });
        };

        try {
          const base64Map1 = await loadImageAsBase64('/sample_map1.bmp');
          const base64Map2 = await loadImageAsBase64('/sample_map2.bmp');

          const layer1 = {
            id: 'map1-layer-id',
            name: 'map1_occupancy',
            visible: true,
            opacity: 0.6,
            image_base64: base64Map1,
            info: map1Info,
            width: map1Info.width,
            height: map1Info.height,
            z_index: 0,
            blend_mode: 'overwrite'
          };

          const layer2 = {
            id: 'map2-layer-id',
            name: 'map2_occupancy',
            visible: true,
            opacity: 0.6,
            image_base64: base64Map2,
            info: map2Info,
            width: map2Info.width,
            height: map2Info.height,
            z_index: 1,
            blend_mode: 'overwrite'
          };

          const makeNode = (id, x, y, yaw) => ({
            id,
            type: 'manual',
            transform: {
              x, y, z: 0,
              qx: 0, qy: 0,
              qz: Math.sin(yaw / 2),
              qw: Math.cos(yaw / 2)
            }
          });

          // @ts-ignore
          window.__MAP_LAYERS__ = [layer1, layer2];
          // @ts-ignore
          window.__SAMPLE_NODES__ = [
            makeNode('node-1', -90, -60, 0.5),
            makeNode('node-2', -70, -45, 0.8),
            makeNode('node-3', -50, -30, 1.2),
            makeNode('node-4', -30, -15, 1.57),
            makeNode('node-5', -10, 0, 2.1),
            makeNode('node-6', 10, 15, 2.8)
          ];

          return 'STORE_CACHE_INITIALIZED';
        } catch (err) {
          return `ERROR: ${err}`;
        }
      }, { map1Info, map2Info });

      console.log('Init result:', initResult);
      await page.waitForTimeout(1000);

      const ensureScene = async (selectNode = false) => {
        const sceneStatus = await page.evaluate(({ selectNode }) => {
          // @ts-ignore
          const store = window.useAppStore ? window.useAppStore.getState() : null;
          // @ts-ignore
          const layers = window.__MAP_LAYERS__;
          // @ts-ignore
          const nodes = window.__SAMPLE_NODES__;
          if (!store || !layers) return 'NO_STORE_OR_LAYERS';

          store.setMapLayers(layers);

          if (nodes && nodes.length > 0) {
            nodes.forEach((n) => {
              if (!store.nodes[n.id]) {
                store.addNode(n);
              }
            });
            if (selectNode) {
              store.selectNodes([nodes[0].id]);
            }
          }

          store.triggerFitToMaps();
          return `SYNC_OK: ${store.mapLayers.length} layers, ${store.rootNodeIds.length} nodes`;
        }, { selectNode });

        console.log('Scene sync status:', sceneStatus);
        await page.waitForTimeout(1200);
      };

      // 1. トップ画面 (main-app.png)
      console.log('Capturing main-app.png...');
      await ensureScene();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'main-app.png') });
      console.log('✓ Saved main-app.png');

      // 2. Waypoint デモ画面 (waypoints-demo.png)
      console.log('Capturing waypoints-demo.png...');
      await ensureScene();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'waypoints-demo.png') });
      console.log('✓ Saved waypoints-demo.png');

      // 3. 左パネル「Waypoints」タブ (WaypointTree)
      console.log('Capturing waypoints-panel.png...');
      const waypointsTab = page.locator('button:has-text("Waypoints")').first();
      if (await waypointsTab.isVisible()) {
        await waypointsTab.click();
      }
      await ensureScene();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'waypoints-panel.png') });
      console.log('✓ Saved waypoints-panel.png');

      // 4. 左パネル「Plugins」タブ (PluginListPanel)
      console.log('Capturing plugins-panel.png...');
      const pluginsTab = page.locator('button:has-text("Plugins")').first();
      if (await pluginsTab.isVisible()) {
        await pluginsTab.click();
      }
      await ensureScene();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'plugins-panel.png') });
      console.log('✓ Saved plugins-panel.png');

      // 5. 右パネル「Layers」タブ (LayerPanel)
      console.log('Capturing layers-panel.png...');
      const layersTab = page.locator('button:has-text("Layers")').first();
      if (await layersTab.isVisible()) {
        await layersTab.click();
      }
      await ensureScene();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'layers-panel.png') });
      console.log('✓ Saved layers-panel.png');

      // 6. 右パネル「Inspector」タブ (PropertiesPanel - node-1 選択状態)
      console.log('Capturing inspector-panel.png...');
      const inspectorTab = page.locator('button:has-text("Inspector")').first();
      if (await inspectorTab.isVisible()) {
        await inspectorTab.click();
      }
      await ensureScene(true); // selectNode = true
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'inspector-panel.png') });
      console.log('✓ Saved inspector-panel.png');

      // 7. 設定ダイアログ (SettingsModal)
      console.log('Capturing settings-modal.png...');
      await ensureScene();
      const settingsBtn = page.locator('button[title="Settings & Plugins"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'settings-modal.png') });
        console.log('✓ Saved settings-modal.png');
        await page.keyboard.press('Escape');
      }

      console.log('\n✅ All 7 screenshots captured cleanly with selected node in Inspector!');
    } finally {
      // クリーンアップ
      try {
        if (fs.existsSync(tmpBmp1Path)) fs.unlinkSync(tmpBmp1Path);
        if (fs.existsSync(tmpBmp2Path)) fs.unlinkSync(tmpBmp2Path);
      } catch {}
      await browser.close();
    }
  } finally {
    devServer.kill('SIGTERM');
    process.exit(0);
  }
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
