import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPdfContent {
  totalPages: number;
  extractedTextWithPages: string;
  pageSnapshots: { pageNumber: number; mimeType: string; data: string }[];
}

/**
 * Extracts text from all pages of a PDF (preserving explicit [Página N] markers)
 * and renders compressed JPEG snapshots of pages so Gemini can analyze figures and diagrams
 * while keeping the HTTP payload well below Cloud Run / proxy limits (< 2MB).
 */
export async function extractPdfContentClientSide(
  file: File,
  onProgress?: (status: string) => void
): Promise<ExtractedPdfContent> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];
  const pageSnapshots: { pageNumber: number; mimeType: string; data: string }[] = [];

  const maxTextPages = Math.min(totalPages, 40);
  const maxImagePages = Math.min(totalPages, 6);

  for (let pageNum = 1; pageNum <= maxTextPages; pageNum++) {
    if (onProgress) {
      onProgress(`Lendo página ${pageNum} de ${totalPages}...`);
    }
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (lines) {
      pageTexts.push(`[Página ${pageNum}]\n${lines}`);
    } else {
      pageTexts.push(`[Página ${pageNum}]\n(Página contendo figura ou imagem digitalizada)`);
    }

    // Render compressed snapshot of first up to 6 pages to capture figures/diagrams
    if (pageNum <= maxImagePages) {
      try {
        const viewport = page.getViewport({ scale: 1.0 });
        const maxDim = 960;
        const scale = Math.min(1.0, maxDim / Math.max(viewport.width, viewport.height, 1));
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(scaledViewport.width);
        canvas.height = Math.round(scaledViewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any)
            .promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          const base64Data = dataUrl.split(',')[1] || '';
          if (base64Data && base64Data.length < 350_000) {
            pageSnapshots.push({
              pageNumber: pageNum,
              mimeType: 'image/jpeg',
              data: base64Data,
            });
          }
        }
      } catch {
        // Ignore canvas snapshot failure on individual page
      }
    }
  }

  return {
    totalPages,
    extractedTextWithPages: pageTexts.join('\n\n'),
    pageSnapshots,
  };
}

/**
 * Safely parses a fetch Response, converting HTML proxy errors (e.g. 413 Payload Too Large,
 * 502/504 Gateway Timeout returning "<!doctype html>...") into clear Portuguese error objects.
 */
export async function parseApiResponse<T = any>(resp: Response): Promise<T> {
  const contentType = resp.headers.get('content-type') || '';
  const rawText = await resp.text();

  if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
    try {
      return JSON.parse(rawText) as T;
    } catch {
      // fall through to HTML / text handling
    }
  }

  if (resp.status === 413) {
    throw new Error(
      'O arquivo enviado excedeu o limite de tamanho da requisição (Erro 413). O aplicativo agora compacta as páginas automaticamente — tente novamente.'
    );
  }

  if (resp.status === 404 || rawText.includes('NOT_FOUND')) {
    throw new Error(
      'Rota da API não encontrada no servidor (HTTP 404). Se você fez deploy na Vercel, faça um novo deploy com a pasta /api e o arquivo vercel.json atualizados e configure a variável GEMINI_API_KEY no painel da Vercel.'
    );
  }

  if (resp.status === 502 || resp.status === 504) {
    throw new Error(
      `O servidor demorou muito para responder (${resp.status}). Tente novamente com um documento menor ou em alguns instantes.`
    );
  }

  if (rawText.trim().toLowerCase().startsWith('<!doctype') || rawText.includes('<html')) {
    throw new Error(
      `O servidor retornou uma resposta inesperada (HTTP ${resp.status}). Clique em "Tentar novamente".`
    );
  }

  throw new Error(rawText || `Erro na comunicação com o servidor (HTTP ${resp.status}).`);
}
