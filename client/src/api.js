async function request(url, options) {
  try { return await fetch(url, { ...options, signal: AbortSignal.timeout(150000) }); }
  catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("The request took too long. Your resume was not changed. Check the provider and try again.");
    throw new Error("Could not reach the server. Your resume was not changed. Check that it is running.");
  }
}

export async function parseText(text) {
  const res = await request("/api/parse/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

export async function parseFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await request("/api/parse/file", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

export async function improveText(text, action, context = {}) {
  const res = await request("/api/ai/improve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, action, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI error");
  return data.result;
}

export async function tailorResume(resume, jobDescription) {
  const res = await request("/api/ai/tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume, jobDescription }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI error");
  return data;
}

export async function exportPDF(html, filename) {
  const res = await request("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, filename }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "PDF generation failed");
  }
  return res.blob();
}
