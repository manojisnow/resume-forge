async function renderPDF(html) {
  const { default: puppeteer } = await import("puppeteer");
  const { PRINT_CSS } = await import("../shared/print.mjs");
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, timeout: 30000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", request => {
      if (request.url().startsWith("data:")) request.continue();
      else request.abort();
    });
    await page.emulateMediaType("print");
    await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src 'none'; script-src 'none'">
      <style>* { box-sizing: border-box; margin: 0; padding: 0; } html, body { width: 210mm; background: white; } ${PRINT_CSS}</style>
      </head><body>${html}</body></html>`, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true, timeout: 30000,
      margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = { renderPDF };
