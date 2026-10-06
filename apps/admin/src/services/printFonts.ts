// Printrapporten zijn verborgen tot het afdrukken, dus de browser laadt hun fonts niet vanzelf.
// De voorbeeldtekst dwingt bij EB Garamond ook de latin-ext subset af (bv. Pogačar).
const sampleText = 'Aa1 €–čćšžłøåéñ';

export const loadPrintFonts = async () => {
  try {
    await Promise.all([
      "400 10pt Lato",
      "600 10pt Lato",
      "700 10pt Lato",
      "400 10pt 'EB Garamond'",
      "600 10pt 'EB Garamond'",
      "700 10pt 'EB Garamond'"
    ].map(font => document.fonts.load(font, sampleText)));
  } catch {
    // Bij een laadfout drukken we af met de fallback-fonts.
  }
};
