import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

async function run() {
  console.log('Starting Vite dev server...');
  const devServer = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
  
  devServer.stdout.on('data', data => console.log('Vite:', data.toString()));
  devServer.stderr.on('data', data => console.error('Vite Err:', data.toString()));
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Launching Playwright Chrome...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('Browser Console:', msg.text()));
  page.on('pageerror', err => console.log('Browser Error:', err.message));
  
  try {
    console.log('Navigating to http://localhost:1420 ...');
    await page.goto('http://localhost:1420', { waitUntil: 'load' });
    
    // Screenshot to see what's actually there
    await page.screenshot({ path: '/tmp/screenshot.png' });
    
    await page.waitForSelector('text="Project / Hierarchy"', { timeout: 10000 });
    console.log('Layout is rendered without Tauri shell.');
    
    await page.click('text="Layers"');
    await page.waitForSelector('text="Load ROS Map (YAML)"');
    await page.click('text="Load ROS Map (YAML)"');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const isCanvasPresent = await page.evaluate(() => document.querySelector('canvas') !== null);
    if (isCanvasPresent) {
      console.log('✓ Canvas component detected.');
    }
    
    console.log('\n✅ ALL VITE STANDALONE CHECKS PASSED!');
  } catch (error) {
    console.error('\n❌ STANDALONE TEST FAILED:\n', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    devServer.kill();
    process.exit();
  }
}
run();
