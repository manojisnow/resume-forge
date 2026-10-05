import React from "react";

function skillItems(items) {
  return Array.isArray(items) ? items.join(", ") : (items || "");
}

function ExpItem({ item, accent, variant }) {
  const bullets = Array.isArray(item.bullets) ? item.bullets.filter(Boolean) : [];
  const isTech = variant === "tech";
  return (
    <div data-resume-entry style={{ marginBottom: 14, paddingLeft: isTech ? 10 : 0, borderLeft: isTech ? `2px solid ${accent}33` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ fontSize: isTech ? "11px" : "11.5px", color: isTech ? "#f1f5f9" : "#1a1a1a" }}>{item.role}</strong>
        <span style={{ fontSize: "9.5px", color: isTech ? "#64748b" : "#888", whiteSpace: "nowrap", marginLeft: 8 }}>
          {item.start}{(item.end || item.current) ? ` – ${item.current ? "Present" : item.end}` : ""}
        </span>
      </div>
      <p style={{ margin: "2px 0 6px", color: accent, fontSize: "10.5px", fontWeight: 600 }}>{item.company}</p>
      {bullets.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 16, color: isTech ? "#94a3b8" : "#555", lineHeight: 1.7 }}>
          {bullets.map((b, i) => <li key={i} style={{ marginBottom: 2 }}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ModernTemplate({ data, accent }) {
  const { personal, experience, education, skills, certifications, projects } = data;
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 11, color: "#1a1a1a", background: "#fff", display: "flex", minHeight: "297mm", width: "210mm" }}>
      <div style={{ width: "38%", background: accent, color: "#fff", padding: "32px 20px", flexShrink: 0 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.2 }}>{personal.name || "Your Name"}</h1>
          <p style={{ fontSize: 12, margin: 0, opacity: 0.85, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>{personal.title || "Job Title"}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 10px", opacity: 0.6 }}>Contact</h3>
          {[["✉", personal.email], ["☎", personal.phone], ["⊙", personal.location], ["in", personal.linkedin], ["⌥", personal.github], ["↗", personal.website]].filter(([, v]) => v).map(([icon, val]) => (
            <p key={val} style={{ margin: "0 0 6px", fontSize: 10.5, display: "flex", gap: 8, opacity: 0.9, wordBreak: "break-all" }}><span style={{ opacity: 0.6, minWidth: 14 }}>{icon}</span>{val}</p>
          ))}
        </div>
        {skills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 10px", opacity: 0.6 }}>Skills</h3>
            {skills.map(s => (
              <div data-resume-entry key={s.id} style={{ marginBottom: 8 }}>
                {s.category && <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 3px", opacity: 0.7 }}>{s.category}</p>}
                <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, opacity: 0.9 }}>{skillItems(s.items)}</p>
              </div>
            ))}
          </div>
        )}
        {certifications.length > 0 && (
          <div>
            <h3 style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 10px", opacity: 0.6 }}>Certifications</h3>
            {certifications.map(c => (
              <div data-resume-entry key={c.id} style={{ marginBottom: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 10.5 }}>{c.name}</p>
                <p style={{ margin: 0, opacity: 0.75, fontSize: 9.5 }}>{c.issuer}{c.year ? ` · ${c.year}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "32px 28px" }}>
        {personal.summary && <Section title="Profile" accent={accent}><p style={{ margin: 0, lineHeight: 1.7, color: "#444" }}>{personal.summary}</p></Section>}
        {experience.length > 0 && <Section title="Experience" accent={accent}>{experience.map(e => <ExpItem key={e.id} item={e} accent={accent} />)}</Section>}
        {education.length > 0 && (
          <Section title="Education" accent={accent}>
            {education.map(e => (
              <div data-resume-entry key={e.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12 }}>{e.institution}</strong>
                  <span style={{ fontSize: 10, color: "#888" }}>{e.start}{e.end ? ` – ${e.end}` : ""}</span>
                </div>
                <p style={{ margin: "2px 0 0", color: accent, fontSize: 10.5 }}>{e.degree}{e.field ? ` · ${e.field}` : ""}</p>
                {e.gpa && <p style={{ margin: "2px 0 0", color: "#666", fontSize: 10 }}>GPA: {e.gpa}</p>}
              </div>
            ))}
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Projects" accent={accent}>
            {projects.map(p => (
              <div data-resume-entry key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 11.5 }}>{p.name}</strong>
                  {p.url && <span style={{ fontSize: 9.5, color: accent }}>{p.url}</span>}
                </div>
                {p.tech && <p style={{ margin: "2px 0", fontSize: 9.5, color: "#888", fontStyle: "italic" }}>{p.tech}</p>}
                {p.description && <p style={{ margin: "2px 0 0", color: "#555", lineHeight: 1.6, fontSize: 10.5 }}>{p.description}</p>}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

export function ClassicTemplate({ data, accent }) {
  const { personal, experience, education, skills, certifications, projects } = data;
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 11, color: "#1a1a1a", background: "#fff", padding: "36px 48px", minHeight: "297mm", width: "210mm", boxSizing: "border-box" }}>
      <div style={{ textAlign: "center", borderBottom: `2px solid ${accent}`, paddingBottom: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "1px" }}>{personal.name || "Your Name"}</h1>
        {personal.title && <p style={{ margin: "0 0 8px", fontSize: 13, color: accent, fontStyle: "italic" }}>{personal.title}</p>}
        <div style={{ fontSize: 10, color: "#555", display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {[personal.email, personal.phone, personal.location, personal.linkedin, personal.github].filter(Boolean).map(v => <span key={v}>{v}</span>)}
        </div>
      </div>
      {personal.summary && <CSection title="Professional Summary" accent={accent}><p style={{ margin: 0, lineHeight: 1.8, color: "#444" }}>{personal.summary}</p></CSection>}
      {experience.length > 0 && <CSection title="Professional Experience" accent={accent}>{experience.map(e => <ExpItem key={e.id} item={e} accent={accent} variant="classic" />)}</CSection>}
      {education.length > 0 && (
        <CSection title="Education" accent={accent}>
          {education.map(e => (
            <div data-resume-entry key={e.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{e.degree}{e.field ? `, ${e.field}` : ""}</strong>
                <span style={{ color: "#888", fontSize: 10 }}>{e.start}{e.end ? ` – ${e.end}` : ""}</span>
              </div>
              <p style={{ margin: "2px 0 0", fontStyle: "italic", color: "#555" }}>{e.institution}</p>
            </div>
          ))}
        </CSection>
      )}
      {skills.length > 0 && (
        <CSection title="Skills" accent={accent}>
          {skills.map(s => (
            <div data-resume-entry key={s.id} style={{ marginBottom: 4, display: "flex", gap: 8 }}>
              {s.category && <span style={{ fontWeight: 700, minWidth: 120 }}>{s.category}:</span>}
              <span style={{ color: "#444" }}>{skillItems(s.items)}</span>
            </div>
          ))}
        </CSection>
      )}
      {certifications.length > 0 && (
        <CSection title="Certifications" accent={accent}>
          {certifications.map(c => (
            <div data-resume-entry key={c.id} style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <span><strong>{c.name}</strong>{c.issuer ? ` — ${c.issuer}` : ""}</span>
              {c.year && <span style={{ color: "#888" }}>{c.year}</span>}
            </div>
          ))}
        </CSection>
      )}
      {projects.length > 0 && (
        <CSection title="Projects" accent={accent}>
          {projects.map(p => (
            <div data-resume-entry key={p.id} style={{ marginBottom: 8 }}>
              <strong>{p.name}</strong>
              {p.tech && <span style={{ fontStyle: "italic", color: "#666", marginLeft: 8 }}>({p.tech})</span>}
              {p.description && <p style={{ margin: "2px 0 0", color: "#555", lineHeight: 1.6 }}>{p.description}</p>}
            </div>
          ))}
        </CSection>
      )}
    </div>
  );
}

export function ExecutiveTemplate({ data, accent }) {
  const { personal, experience, education, skills, certifications, projects } = data;
  return (
    <div style={{ fontFamily: "'Palatino Linotype', Palatino, Georgia, serif", fontSize: 11, color: "#1a1a1a", background: "#fafaf8", minHeight: "297mm", width: "210mm" }}>
      <div style={{ background: accent, padding: "40px 48px 28px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 400, margin: "0 0 6px", color: "#fff", letterSpacing: "2px", textTransform: "uppercase" }}>{personal.name || "Your Name"}</h1>
        {personal.title && <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: "3px", textTransform: "uppercase" }}>{personal.title}</p>}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 10, color: "rgba(255,255,255,0.8)", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12 }}>
          {[personal.email, personal.phone, personal.location, personal.linkedin].filter(Boolean).map(v => <span key={v}>{v}</span>)}
        </div>
      </div>
      <div style={{ padding: "28px 48px" }}>
        {personal.summary && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#fff", borderLeft: `4px solid ${accent}` }}>
            <p style={{ margin: 0, lineHeight: 1.9, color: "#444", fontStyle: "italic", fontSize: 11.5 }}>{personal.summary}</p>
          </div>
        )}
        {experience.length > 0 && <ESection title="Career History" accent={accent}>{experience.map(e => <ExpItem key={e.id} item={e} accent={accent} />)}</ESection>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            {education.length > 0 && (
              <ESection title="Education" accent={accent}>
                {education.map(e => (
                  <div data-resume-entry key={e.id} style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: 11.5 }}>{e.degree}{e.field ? `, ${e.field}` : ""}</strong>
                    <p style={{ margin: "2px 0", color: "#555", fontStyle: "italic" }}>{e.institution}</p>
                    <p style={{ margin: 0, color: "#888", fontSize: 9.5 }}>{e.start}{e.end ? ` – ${e.end}` : ""}</p>
                  </div>
                ))}
              </ESection>
            )}
            {certifications.length > 0 && (
              <ESection title="Certifications" accent={accent}>
                {certifications.map(c => (
                  <div data-resume-entry key={c.id} style={{ marginBottom: 6 }}>
                    <strong style={{ fontSize: 11 }}>{c.name}</strong>
                    <p style={{ margin: 0, color: "#666", fontSize: 10 }}>{c.issuer}{c.year ? ` · ${c.year}` : ""}</p>
                  </div>
                ))}
              </ESection>
            )}
          </div>
          <div>
            {skills.length > 0 && (
              <ESection title="Expertise" accent={accent}>
                {skills.map(s => (
                  <div data-resume-entry key={s.id} style={{ marginBottom: 8 }}>
                    {s.category && <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", color: accent }}>{s.category}</p>}
                    <p style={{ margin: 0, color: "#555", lineHeight: 1.7 }}>{skillItems(s.items)}</p>
                  </div>
                ))}
              </ESection>
            )}
            {projects.length > 0 && (
              <ESection title="Key Projects" accent={accent}>
                {projects.map(p => (
                  <div data-resume-entry key={p.id} style={{ marginBottom: 8 }}>
                    <strong>{p.name}</strong>
                    {p.tech && <span style={{ color: "#888", fontSize: 9.5 }}> · {p.tech}</span>}
                    {p.description && <p style={{ margin: "2px 0 0", color: "#555", lineHeight: 1.6 }}>{p.description}</p>}
                  </div>
                ))}
              </ESection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TechTemplate({ data, accent }) {
  // The palette contains dark accents; lighten them for the dark template.
  const rgb = accent.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16));
  accent = "#" + rgb.map(v => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0")).join("");
  const { personal, experience, education, skills, certifications, projects } = data;
  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10.5, color: "#e2e8f0", background: "#0f172a", minHeight: "297mm", width: "210mm" }}>
      <div style={{ padding: "32px 36px", borderBottom: `2px solid ${accent}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 10, color: accent }}>// resume.json</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", color: "#f8fafc" }}>{personal.name || "Your Name"}</h1>
            <p style={{ margin: 0, fontSize: 12, color: accent }}>{personal.title || "Title"}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 9.5, color: "#64748b", lineHeight: 2 }}>
            {[personal.email, personal.phone, personal.location].filter(Boolean).map(v => <p key={v} style={{ margin: 0 }}>{v}</p>)}
            {personal.github && <p style={{ margin: 0, color: accent }}>{personal.github}</p>}
          </div>
        </div>
      </div>
      <div style={{ padding: "24px 36px" }}>
        {personal.summary && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: "0 0 8px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** SUMMARY */</p>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.8 }}>{personal.summary}</p>
          </div>
        )}
        {skills.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: "0 0 10px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** TECH STACK */</p>
            {skills.map(s => (
              <div data-resume-entry key={s.id} style={{ marginBottom: 6, display: "flex", gap: 12 }}>
                {s.category && <span style={{ color: "#64748b", minWidth: 130, fontSize: 10 }}>{s.category}:</span>}
                <span>{skillItems(s.items)}</span>
              </div>
            ))}
          </div>
        )}
        {experience.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: "0 0 14px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** EXPERIENCE */</p>
            {experience.map(e => <ExpItem key={e.id} item={e} accent={accent} variant="tech" />)}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            {projects.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** PROJECTS */</p>
                {projects.map(p => (
                  <div data-resume-entry key={p.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${accent}33` }}>
                    <p style={{ margin: "0 0 2px", color: "#f1f5f9", fontWeight: 700 }}>{p.name}</p>
                    {p.tech && <p style={{ margin: "0 0 3px", color: accent, fontSize: 9.5 }}>{p.tech}</p>}
                    {p.url && <p style={{ margin: "0 0 3px", color: "#64748b", fontSize: 9 }}>{p.url}</p>}
                    {p.description && <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6 }}>{p.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            {education.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** EDUCATION */</p>
                {education.map(e => (
                  <div data-resume-entry key={e.id} style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 2px", color: "#f1f5f9", fontWeight: 700 }}>{e.degree}{e.field ? `, ${e.field}` : ""}</p>
                    <p style={{ margin: "0 0 2px", color: "#94a3b8" }}>{e.institution}</p>
                    <p style={{ margin: 0, color: "#64748b", fontSize: 9.5 }}>{e.start}{e.end ? ` – ${e.end}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
            {certifications.length > 0 && (
              <div>
                <p style={{ margin: "0 0 10px", color: accent, fontSize: 9, letterSpacing: "2px", textTransform: "uppercase" }}>/** CERTS */</p>
                {certifications.map(c => (
                  <div data-resume-entry key={c.id} style={{ marginBottom: 6 }}>
                    <p style={{ margin: 0, color: "#f1f5f9" }}>{c.name}</p>
                    <p style={{ margin: 0, color: "#64748b", fontSize: 9.5 }}>{c.issuer}{c.year ? ` · ${c.year}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared section wrappers
function Section({ title, accent, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div data-resume-heading style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "1px", color: accent }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: `${accent}33` }} />
      </div>
      {children}
    </div>
  );
}
function CSection({ title, accent, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "1.5px", color: accent, borderBottom: `1px solid ${accent}44`, paddingBottom: 4 }}>{title}</h2>
      {children}
    </div>
  );
}
function ESection({ title, accent, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", color: accent, margin: "0 0 10px", borderBottom: `1px solid ${accent}33`, paddingBottom: 6 }}>{title}</h2>
      {children}
    </div>
  );
}
