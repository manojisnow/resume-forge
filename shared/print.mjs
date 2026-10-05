// Keep the browser's print styling and server-rendered PDF styling in sync.
export const PRINT_CSS = `
@page { size: A4; margin: 0; }
#resume-preview, #resume-preview * { overflow-wrap: anywhere; }
@media print {
  #resume-preview { overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; width: 210mm; }
  #resume-preview > div { min-height: 297mm; }
  #resume-preview h1, #resume-preview h2, #resume-preview h3, [data-resume-heading] { break-after: avoid-page; }
  #resume-preview p { orphans: 3; widows: 3; }
  #resume-preview li { break-inside: avoid-page; }
  #resume-preview:not([data-keep-entries="false"]) [data-resume-entry] { break-inside: avoid-page; }
  #resume-preview [data-break-before="true"] { break-before: page; }
}
`;
