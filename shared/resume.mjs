export const SECTIONS = ["experience", "education", "skills", "certifications", "projects"];
const PERSONAL = ["name", "title", "email", "phone", "location", "linkedin", "github", "website", "summary"];
const FIELDS = {
  experience: ["company", "role", "start", "end"],
  education: ["institution", "degree", "field", "start", "end", "gpa"],
  skills: ["category"], certifications: ["name", "issuer", "year"],
  projects: ["name", "description", "tech", "url"],
};

export class ValidationError extends Error {}
function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${name} must be an object.`);
}
function text(value, name) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 20000) throw new ValidationError(`${name} must be text (maximum 20,000 characters).`);
  return value;
}
function list(value, name, max = 200) {
  if (!Array.isArray(value) || value.length > max) throw new ValidationError(`${name} must be a list (maximum ${max} items).`);
  return value;
}

// Both AI adapters and browser imports use the same canonical representation.
export function validateResume(value) {
  object(value, "Resume"); object(value.personal, "Personal details");
  const result = { personal: Object.fromEntries(PERSONAL.map(key => [key, text(value.personal[key], `personal.${key}`)])) };
  for (const section of SECTIONS) {
    const ids = new Set();
    result[section] = list(value[section] ?? [], section).map((entry, index) => {
      object(entry, `${section}[${index}]`);
      const id = text(entry.id ?? String(index + 1), `${section}.id`);
      if (!id || ids.has(id)) throw new ValidationError(`${section} contains an empty or duplicate ID.`);
      ids.add(id);
      const item = { id, ...Object.fromEntries(FIELDS[section].map(key => [key, text(entry[key], `${section}.${key}`)])) };
      if (section === "experience") {
        if (entry.current !== undefined && typeof entry.current !== "boolean") throw new ValidationError("experience.current must be true or false.");
        item.current = entry.current ?? false;
        item.bullets = list(entry.bullets ?? [], "experience.bullets").map(v => text(v, "Bullet"));
      }
      if (section === "skills") {
        const items = typeof entry.items === "string" ? entry.items.split(",").map(v => v.trim()).filter(Boolean) : entry.items ?? [];
        item.items = list(items, "skills.items").map(v => text(v, "Skill"));
      }
      return item;
    });
  }
  return result;
}

export function blankResume() {
  return validateResume({ personal: {} });
}

export function parseAIJSON(raw) {
  if (typeof raw !== "string") throw new ValidationError("The AI response was not text.");
  const clean = raw.replace(/```(?:json)?/g, "").trim();
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new ValidationError("The AI did not return a JSON object. Your resume was not changed.");
  try { return JSON.parse(clean.slice(start, end + 1)); }
  catch { throw new ValidationError("The AI returned invalid JSON. Your resume was not changed."); }
}

export function validateTailoring(value, resume) {
  object(value, "Analysis");
  if (!Number.isInteger(value.score) || value.score < 0 || value.score > 100) throw new ValidationError("The analysis score must be between 0 and 100.");
  const missingKeywords = list(value.missingKeywords, "Missing keywords", 8).map(v => text(v, "Keyword"));
  const suggestions = list(value.suggestions, "Suggestions", 5).map(s => {
    object(s, "Suggestion");
    const item = resume.experience.find(e => e.id === s.itemId);
    if (!item || !Number.isInteger(s.bulletIndex) || s.bulletIndex < 0 || s.bulletIndex >= item.bullets.length
        || s.original !== item.bullets[s.bulletIndex]) throw new ValidationError("An AI suggestion does not match the source resume.");
    const improved = text(s.improved, "Suggested text");
    if (!improved.trim()) throw new ValidationError("An AI suggestion was empty.");
    return { itemId: item.id, bulletIndex: s.bulletIndex, original: s.original, improved };
  });
  return { score: value.score, missingKeywords, suggestions };
}
