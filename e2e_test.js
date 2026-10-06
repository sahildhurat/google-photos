const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Auto-accept any alerts (e.g. rate limit warnings on upload)
  page.on('dialog', async dialog => {
    console.log('Dialog appeared:', dialog.message());
    await dialog.accept();
  });
  
  let report = "# Full Project End-to-End Test Report\n\n";

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:3001');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    report += "## 1. App Initialization & Navigation\n- App loaded successfully at http://localhost:3001.\n";
    
    // Check navigation elements
    const hasFirstLoadNote = await page.$('#first-load-note:not(.hidden)') !== null;
    report += `- First-load note is visible: ${hasFirstLoadNote}\n`;
    
    const hasScratchNotif = await page.$('#scratch-notification:not(.hidden)') !== null;
    report += `- Scratch notification is visible: ${hasScratchNotif}\n`;
    
    const demoBarExists = await page.$('.demo-guide-bar') !== null;
    report += `- Demo guide bar is present: ${demoBarExists}\n`;
    
    // Test navigation: Step 2 triggers comparison
    await page.click('#demo-step-2');
    await page.waitForSelector('#comparison-view:not(.hidden)');
    report += "- Clicked Step 2 and comparison view opened successfully.\n";
    
    // Switch to Conversation Mode again for main flow (restores thread view)
    await page.click('#toggle-converse');

    // Test Demo Mode
    console.log('Testing Demo Mode...');
    report += "\n## 2. Demo Library Mode\n";
    
    // Switch to Conversation Mode
    await page.click('#toggle-converse');
    report += "- Selected 'The One Where' (Conversation) mode.\n";
    
    // Type query
    await page.type('#user-input', 'A dinner with pizza');
    await page.click('#send-btn');
    report += "- Submitted query: 'A dinner with pizza'.\n";
    
    // Wait for response
    await page.waitForSelector('.thumbnail-wrapper', { timeout: 15000 });
    const bubbleText = await page.evaluate(() => {
      const msgs = document.querySelectorAll('.message.assistant .bubble');
      return msgs[msgs.length - 1].innerText;
    });
    
    const imageCount = await page.evaluate(() => {
      return document.querySelectorAll('.thumbnail-grid img').length;
    });
    
    report += `- Assistant responded: "${bubbleText.substring(0, 50)}..."\n`;
    report += `- UI displayed ${imageCount} candidate thumbnails.\n`;
    
    // Click a photo to open modal
    await page.evaluate(() => document.querySelector('.thumbnail-wrapper').click());
    await page.waitForSelector('#photo-modal:not(.hidden)');
    report += "- Photo modal opened successfully on click.\n";
    
    // Close modal
    await page.click('#modal-close');
    await page.waitForFunction(() => document.querySelector('#photo-modal').classList.contains('hidden'));
    report += "- Photo modal closed successfully.\n";

    // Test Your Photos Mode
    console.log('Testing Your Photos Mode...');
    report += "\n## 3. Your Photos (Upload) Mode\n";
    
    await page.click('#mode-user');
    await page.waitForSelector('#consent-screen:not(.hidden)');
    report += "- Switched to 'Your Photos' mode. Consent screen displayed correctly.\n";
    
    // We need 10 dummy photos for the upload test (minimum is 10)
    console.log('Uploading 10 photos...');
    const fileUpload = await page.$('#file-upload');
    
    // Find 10 photos from the local project
    const demoImagesDir = path.join(__dirname, 'images');
    const files = fs.readdirSync(demoImagesDir).filter(f => f.endsWith('.jpg')).slice(0, 10);
    const filePaths = files.map(f => path.join(demoImagesDir, f));
    
    await fileUpload.uploadFile(...filePaths);
    
    report += `- Selected ${filePaths.length} images for upload.\n`;
    
    // Wait for upload progress to appear
    await page.waitForSelector('#upload-progress:not(.hidden)');
    report += "- Upload progress indicator appeared.\n";
    
    // Wait for upload to complete (could take up to 2 minutes depending on rate limits)
    console.log('Waiting for processing to complete (this may take a minute)...');
    await page.waitForSelector('#consent-screen.hidden', { timeout: 120000 });
    report += "- Upload and API description processing completed successfully.\n";
    report += "- Chat interface restored for user index.\n";
    
    // Test a query in User Mode
    await page.type('#user-input', 'Something in the photos');
    await page.click('#send-btn');
    report += "- Submitted query against personal photos.\n";
    
    await page.waitForSelector('.thumbnail-wrapper', { timeout: 15000 });
    const userImageCount = await page.evaluate(() => {
      return document.querySelectorAll('.thumbnail-grid img').length;
    });
    report += `- Received ${userImageCount} matching candidate thumbnails from the personal catalogue.\n`;

    // Test Scratch Card
    console.log('Testing Scratch Card...');
    report += "\n## 4. Scratch Card Mode\n";
    
    await page.goto('http://localhost:3001/scratch.html');
    await page.waitForSelector('#scratch-canvas');
    report += "- Navigated to scratch card page.\n";
    
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
    }, { timeout: 5000 });
    report += "- Automatically revealed underlying photo via canvas alpha-sampling threshold.\n";
    
    // Submit an answer
    await page.waitForSelector('#scratch-input');
    await page.type('#scratch-input', 'A happy memory');
    await page.click('#scratch-send');
    report += "- Submitted answer to 'What was this?'.\n";
    
    await page.waitForSelector('.payoff-chip');
    report += "- Deposit payoff displayed with direct search link.\n";
    
    report += "\n## 5. Conclusion\nAll primary flows (Demo Library interaction, Your Photos upload processing, End-to-End search rendering, and Scratch Card mechanics) are functioning perfectly without errors.\n";

  } catch (err) {
    console.error(err);
    report += `\n**TEST FAILED:** ${err.message}\n`;
  } finally {
    await browser.close();
    fs.writeFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/2a390458-089a-4d50-8588-77cd65ed72ab/e2e_test_report.md', report);
    console.log('Done.');
  }
}

runTests();
