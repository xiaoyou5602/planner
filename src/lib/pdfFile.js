// App-side PDF reading: wires the PDF.js worker and bundled cMaps, then reads a picked File.
// Kept apart from pdfText.js so tests in Node use PDF.js's built-in fake worker.
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { readPdfPages } from './pdfText.js'

GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_PDF_PAGES = 40

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Throws a message meant for the user; never uploads anything. */
export async function readPdfFile(file, onPage) {
  if (!file) throw new Error('没有选到文件')
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF 超过 20 MB，请换一个小一点的文件')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!bytes.length) throw new Error('这个 PDF 是空文件')
  const hash = await sha256(bytes)
  let result
  try {
    // PDF.js takes ownership of the buffer it is given, so pass a copy.
    result = await readPdfPages(bytes.slice(), { cMapUrl: new URL('pdfjs-cmaps/', document.baseURI).href, onPage, maxPages: MAX_PDF_PAGES })
  } catch (error) {
    if (error?.name === 'TooManyPagesError') throw new Error(`PDF 超过 ${MAX_PDF_PAGES} 页，请只保留课表那几页`)
    if (error?.name === 'PasswordException') throw new Error('这个 PDF 设了密码，请先去掉密码再导入')
    throw new Error('这个文件打不开，可能不是 PDF 或已损坏')
  }
  return { fileName: file.name, sha256: hash, ...result }
}
