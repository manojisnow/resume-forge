require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const { renderPDF } = require("./pdf.cjs");

const app = express();
const resumeSchema = import("../shared/resume.mjs");
const PORT = process.env.PORT || 3001;

// AI calls are isolated so each provider can be verified without live requests.
const { createAI } = require("./ai.cjs");
const { provider: PROVIDER, config: providerCfg, callAI, dataLeavesDevice } = createAI(process.env);

// ── Multer setup ──────────────────────────────────────────────────────────────
app.disable("x-powered-by");
const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
// CORS alone does not stop a cross-origin browser from sending a request.
app.use((req, res, next) => {
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next();
});
app.use(cors({ origin: [...allowedOrigins] }));
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".docx")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are supported."));
    }
  },
});

// ── Prompt templates ──────────────────────────────────────────────────────────
const JSON_STRUCTURE = `{
  "personal": {
    "name": "", "title": "", "email": "", "phone": "",
    "location": "", "linkedin": "", "github": "", "website": "", "summary": ""
  },
  "experience": [{
    "id": "1", "company": "", "role": "", "start": "", "end": "",
    "current": false, "bullets": [""]
  }],
  "education": [{
    "id": "1", "institution": "", "degree": "", "field": "", "start": "", "end": "", "gpa": ""
  }],
  "skills": [{ "id": "1", "category": "", "items": "" }],
  "certifications": [{ "id": "1", "name": "", "issuer": "", "year": "" }],
  "projects": [{ "id": "1", "name": "", "description": "", "tech": "", "url": "" }]
}`;

const PARSE_RULES = `Rules:
- Keep all text exactly as found in the source, do not paraphrase or summarize
- Split each achievement/responsibility into separate strings in the bullets array
- Comma-separate skill items within each category
- Set current=true and end="Present" for the person's active role
- Use sequential string IDs: "1", "2", "3" etc
- Return ONLY the JSON object, no markdown fences, no explanation, no extra text`;

async function parseWithAI(text) {
  const prompt = `Extract resume/CV information from the following text and return ONLY a valid JSON object with this exact structure:\n${JSON_STRUCTURE}\n\n${PARSE_RULES}\n\nCV TEXT:\n${text}`;
  const raw = await callAI(prompt);
  const { validateResume, parseAIJSON } = await resumeSchema;
  return validateResume(parseAIJSON(raw));
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    provider: PROVIDER,
    model: providerCfg.model,
    dataLeavesDevice,
  });
});

app.post("/api/parse/text", async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "No text provided." });
    const result = await parseWithAI(text);
    res.json(result);
  } catch (err) {
    console.error("Text parsing failed.");
    if (err instanceof (await resumeSchema).ValidationError) return res.status(422).json({ error: err.message });
    res.status(500).json({ error: "Text parsing failed. Check your AI provider configuration." });
  }
});

app.post("/api/parse/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    let extractedText = "";
    const isPDF = req.file.mimetype === "application/pdf";
    const isDOCX = req.file.mimetype.includes("wordprocessingml") || req.file.originalname.endsWith(".docx");

    if (isPDF) {
      const data = await pdfParse(req.file.buffer);
      extractedText = data.text;
    } else if (isDOCX) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = result.value;
      if (result.messages.length > 0) console.warn("Document parsing produced warnings.");
    } else {
      return res.status(400).json({ error: "Unsupported file type." });
    }

    if (!extractedText.trim()) {
      return res.status(422).json({
        error: "Could not extract text from file. It may be a scanned image-based PDF. Try copy-pasting the text instead.",
      });
    }

    const result = await parseWithAI(extractedText);
    res.json(result);
  } catch (err) {
    console.error("File parsing failed.");
    if (err instanceof (await resumeSchema).ValidationError) return res.status(422).json({ error: err.message });
    res.status(500).json({ error: "File parsing failed. Check the document and AI provider configuration." });
  }
});

app.post("/api/ai/improve", async (req, res) => {
  const { text, action, context = {} } = req.body;
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "No text provided." });
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return res.status(400).json({ error: "Invalid context." });
  }

  const base = {
    improve: `Rewrite the following resume bullet point to be more impactful using strong action verbs. Return only the rewritten bullet, no explanation, no leading bullet symbol:`,
    concise: `Rewrite the following resume bullet point to be more concise while preserving all key information. Return only the rewritten bullet, no explanation, no leading bullet symbol:`,
    quantify: `Rewrite the following resume bullet point to include or suggest metrics (use placeholders like [X]% or [N] where actual numbers are unknown). Return only the rewritten bullet, no explanation, no leading bullet symbol:`,
    improve_summary: `Rewrite the following resume professional summary to be more compelling and results-focused. Return only the rewritten summary, no explanation:`,
  };

  const contextNote = context.role
    ? `\nContext: ${context.role}${context.company ? ` at ${context.company}` : ""}.`
    : "";
  const prompt = `${base[action] || base.improve}\nPreserve the source facts. Never invent achievements, employers, skills, or numeric results.${contextNote}\n\n${text}`;

  try {
    const result = await callAI(prompt);
    if (typeof result !== "string" || !result.trim()) return res.status(422).json({ error: "AI returned an empty suggestion. Your resume was not changed." });
    res.json({ result: result.trim().replace(/^[-•*]\s*/, "") });
  } catch (err) {
    console.error("AI improvement failed.");
    res.status(500).json({ error: "AI improvement failed. Check your AI provider configuration." });
  }
});

app.post("/api/ai/tailor", async (req, res) => {
  let { resume, jobDescription } = req.body;
  if (typeof jobDescription !== "string" || !jobDescription.trim()) return res.status(400).json({ error: "No job description provided." });
  if (!resume || typeof resume !== "object" || Array.isArray(resume)
      || !Array.isArray(resume.experience) || !Array.isArray(resume.skills)
      || !resume.experience.every(e => e && typeof e === "object" && (!e.bullets || Array.isArray(e.bullets)))
      || !resume.skills.every(s => s && typeof s === "object")) {
    return res.status(400).json({ error: "Invalid resume." });
  }
  try { resume = (await resumeSchema).validateResume(resume); }
  catch { return res.status(400).json({ error: "Invalid resume." }); }

  const resumeText = [
    resume.personal?.summary,
    ...(resume.experience || []).flatMap(e => [e.role, e.company, ...(e.bullets || [])]),
    ...(resume.skills || []).map(s => (Array.isArray(s.items) ? s.items.join(" ") : s.items)),
  ].filter(Boolean).join("\n");

  const experienceCtx = JSON.stringify(
    (resume.experience || []).map(e => ({ id: e.id, role: e.role, bullets: e.bullets || [] }))
  );

  const prompt = `You are an ATS resume optimizer. Analyze this resume against the job description and return ONLY a valid JSON object.

JOB DESCRIPTION:
${jobDescription}

RESUME TEXT:
${resumeText}

EXPERIENCE FOR SUGGESTIONS:
${experienceCtx}

Return this exact JSON structure:
{
  "score": <0-100 integer, realistic % of key JD skills/keywords found in resume>,
  "missingKeywords": [<up to 8 important technical keywords/tools from JD not in resume>],
  "suggestions": [
    {
      "itemId": <experience item id string>,
      "bulletIndex": <0-based index>,
      "original": <original bullet text>,
      "improved": <rewritten bullet naturally incorporating relevant JD keywords>
    }
  ]
}

Rules:
- missingKeywords: technical skills and tools only, not soft skills
- suggestions: up to 5, only where JD keywords can naturally fit
- Never invent skills, employers, achievements, or metrics. Keep original exactly equal to the source bullet.
- Return ONLY the JSON object, no markdown fences, no explanation`;

  try {
    const raw = await callAI(prompt);
    const { parseAIJSON, validateTailoring } = await resumeSchema;
    res.json(validateTailoring(parseAIJSON(raw), resume));
  } catch (err) {
    console.error("AI tailoring failed.");
    if (err instanceof (await resumeSchema).ValidationError) return res.status(422).json({ error: err.message });
    res.status(500).json({ error: "AI tailoring failed. Check your AI provider configuration." });
  }
});

app.post("/api/pdf", async (req, res) => {
  const { html, filename } = req.body;
  if (typeof html !== "string" || !html.trim()) return res.status(400).json({ error: "No HTML provided." });
  if (filename !== undefined && typeof filename !== "string") {
    return res.status(400).json({ error: "Invalid filename." });
  }

  try {
    const pdfBuffer = await renderPDF(html);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(filename || "resume").replace(/[^a-z0-9_\- ]/gi, "_")}.pdf"`,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("PDF generation failed.");
    res.status(500).json({ error: "PDF generation failed. Check your Chromium installation and sandbox support." });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Upload rejected. Maximum file size is 10 MB." });
  }
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request exceeds the 1 MB limit." });
  if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ error: "Invalid JSON." });
  res.status(400).json({ error: "Invalid request or unsupported file type." });
});

if (require.main === module) app.listen(PORT, "127.0.0.1", () => {
  console.log(`\n✅ ResumeForge server running at http://localhost:${PORT}`);
  console.log(`   AI Provider : ${PROVIDER.toUpperCase()}`);
  console.log(`   Model       : ${providerCfg.model}`);
  if (PROVIDER === "anthropic" && (!providerCfg.apiKey || providerCfg.apiKey === "your_api_key_here")) {
    console.warn("\n⚠️  ANTHROPIC_API_KEY not set in server/.env — parsing will fail.");
  }
});

module.exports = app;
