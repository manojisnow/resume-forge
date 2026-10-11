const { PDFParse } = require("pdf-parse");

async function readPDF(buffer) {
  // PDFParse owns a worker; always release it, including on malformed documents.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ pageJoiner: "\n\n" });
    return { text: result.text, numpages: result.total, pageTexts: result.pages.map(page => page.text) };
  } finally {
    await parser.destroy();
  }
}

module.exports = { readPDF };
