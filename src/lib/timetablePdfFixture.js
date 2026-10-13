// Test-only: builds a real PDF shaped like the school export (non-embedded STSong-Light,
// UniGB-UCS2-H, portrait MediaBox shown landscape via /Rotate 90). Fake courses only.

const W = 842, H = 595 // landscape page as seen by the reader

const hex = text => '<' + [...text].map(ch => {
  const code = ch.codePointAt(0)
  if (code > 0xffff) throw new Error('fixture text must stay in the BMP')
  return code.toString(16).padStart(4, '0')
}).join('') + '>'

/** lines: [{ text, x, top, size }] with x / top as 0..1 of the landscape page. */
function contentStream(lines, rotated) {
  const ops = rotated ? ['0 1 -1 0 595 0 cm'] : []
  for (const { text, x, top, size = 8 } of lines) {
    const baseline = H - top * H - size * 0.88 // glyph tops at `top`, ascent 880/1000
    ops.push(`BT /F1 ${size} Tf ${(x * W).toFixed(2)} ${baseline.toFixed(2)} Td ${hex(text)} Tj ET`)
  }
  return ops.join('\n')
}

export function makeTimetablePdf(pages, { rotated = true } = {}) {
  const objects = []
  const add = body => { objects.push(body); return objects.length }
  const descriptor = add('<</Type/FontDescriptor/FontName/STSong-Light/Flags 6/FontBBox[-25 -254 1000 880]/ItalicAngle 0/Ascent 880/Descent -120/CapHeight 880/StemV 93>>')
  // Widths for ASCII CIDs as in the real export, so short lines fit inside one column.
  const cid = add(`<</Type/Font/Subtype/CIDFontType0/BaseFont/STSong-Light/FontDescriptor ${descriptor} 0 R/W[1[207]9 10 374 13[238 375 238 334]17 26 462 27 28 238]/DW 1000/CIDSystemInfo<</Registry(Adobe)/Ordering(GB1)/Supplement 4>>>>`)
  const font = add(`<</Type/Font/Subtype/Type0/BaseFont/STSong-Light-UniGB-UCS2-H/Encoding/UniGB-UCS2-H/DescendantFonts[${cid} 0 R]>>`)
  const pagesId = objects.length + 1 + pages.length * 2
  const kids = []
  for (const lines of pages) {
    const stream = contentStream(lines, rotated)
    const contents = add(`<</Length ${Buffer.byteLength(stream, 'latin1')}>>\nstream\n${stream}\nendstream`)
    const box = rotated ? '[0 0 595 842]/Rotate 90' : '[0 0 842 595]'
    kids.push(add(`<</Type/Page/Parent ${pagesId} 0 R/MediaBox${box}/Resources<</Font<</F1 ${font} 0 R>>>>/Contents ${contents} 0 R>>`))
  }
  add(`<</Type/Pages/Count ${kids.length}/Kids[${kids.map(id => `${id} 0 R`).join(' ')}]>>`)
  const catalog = add(`<</Type/Catalog/Pages ${pagesId} 0 R>>`)
  let out = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => { const at = out.length; out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(at => `${String(at).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<</Size ${objects.length + 1}/Root ${catalog} 0 R>>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(out, 'latin1'))
}
