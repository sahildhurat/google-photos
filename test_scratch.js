const puppeteer = require('puppeteer');

async function testScratch() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/scratch.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    await page.waitForSelector('#scratch-canvas');
    
    const canvas = await page.$('#scratch-canvas');
    const box = await canvas.boundingBox();
    
    // Simulate scratching across the canvas
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        await page.mouse.move(box.x + i * 15, box.y + j * 15, { steps: 1 });
      }
    }
    
    await page.mouse.up();
    
    // Check if it cleared
    await page.waitForFunction(() => {
      const c = document.getElementById('scratch-canvas');
      return c && c.classList.contains('cleared');
    }, { timeout: 2000 });
    
    console.log("Scratch test passed!");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
}

testScratch();
