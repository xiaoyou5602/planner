// PDF text + positions via PDF.js. Android's getTextContents() returns a whole page as one
// string without bounds, so it cannot locate weekday columns; PDF.js gives each text run.
import { getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Text run → page-normalized box (top-left origin, 0..1), after page rotation. */
export function textItemRect(item, viewport) {
  const [a, b, c, d, e, f] = Util.transform(viewport.transform, item.transform)
  const across = Math.hypot(a, b) || 1
  // Advance along the baseline; "up" points from the baseline towards the glyph tops.
  const run = [a / across * item.width * viewport.scale, b / across * item.width * viewport.scale]
  const xs = [e, e + run[0], e + c, e + run[0] + c]
  const ys = [f, f + run[1], f + d, f + run[1] + d]
  return {
    left: Math.min(...xs) / viewport.width,
    top: Math.min(...ys) / viewport.height,
    right: Math.max(...xs) / viewport.width,
    bottom: Math.max(...ys) / viewport.height,
  }
}

export function pageFromTextContent(pageIndex, viewport, content) {
  const blocks = []
  for (const item of content.items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue
    blocks.push({ id: `p${pageIndex}-${blocks.length}`, text: item.str, rects: [textItemRect(item, viewport)] })
  }
  return { pageIndex, widthPt: viewport.width, heightPt: viewport.height, rotation: viewport.rotation, method: 'text', blocks }
}

/**
 * Reads every page. CJK fonts in school exports are usually not embedded, so cMapUrl is
 * required for Chinese text. onPage lets the UI show "第 n / N 页".
 */
export async function readPdfPages(data, { cMapUrl, standardFontDataUrl, onPage, maxPages = Infinity } = {}) {
  const task = getDocument({ data, cMapUrl, cMapPacked: true, standardFontDataUrl, isEvalSupported: false, verbosity: 0 })
  const doc = await task.promise
  try {
    if (doc.numPages > maxPages) throw Object.assign(new Error(`PDF has ${doc.numPages} pages`), { name: 'TooManyPagesError' })
    const pages = []
    for (let index = 0; index < doc.numPages; index++) {
      onPage?.(index, doc.numPages)
      const page = await doc.getPage(index + 1)
      const viewport = page.getViewport({ scale: 1 })
      pages.push(pageFromTextContent(index, viewport, await page.getTextContent()))
      page.cleanup()
    }
    return { pageCount: doc.numPages, pages }
  } finally {
    await task.destroy()
  }
}
