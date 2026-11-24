import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Maximize2,
  Download,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import { GeneratedInfographic, StudyConcept } from '../types';

interface InfographicStudioProps {
  activeConcept: StudyConcept;
  infographic: GeneratedInfographic | null;
  isGenerating: boolean;
  errorState: {
    userMessage: string;
    errorCategory?: string;
    attemptedModel?: string;
    technicalDetails?: string;
  } | null;
  onGenerateInfographic: (customFocus?: string) => void;
  onEditInfographic: (correctionInstruction: string) => void;
  onAskTutorAboutInfographic: (question: string) => void;
}

export const InfographicStudio: React.FC<InfographicStudioProps> = ({
  activeConcept,
  infographic,
  isGenerating,
  errorState,
  onGenerateInfographic,
  onEditInfographic,
  onAskTutorAboutInfographic,
}) => {
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [tutorQuestionInput, setTutorQuestionInput] = useState('');
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const handleDownload = () => {
    if (!infographic) return;
    const link = document.createElement('a');
    link.href = infographic.imageUrl;
    const safeSlug = infographic.conceptTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.download = `infografico-${safeSlug || 'estudo'}-2k.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionInput.trim() || isGenerating) return;
    onEditInfographic(correctionInput.trim());
    setCorrectionInput('');
  };

  const handleAskTutorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q =
      tutorQuestionInput.trim() ||
      `Explique os elementos visuais deste infográfico "${infographic?.visualDirection.shortTitle}" e como ele resume o conceito de ${activeConcept.title}.`;
    onAskTutorAboutInfographic(q);
    setTutorQuestionInput('');
  };

  return (
    <section className="bg-[#FFFDF8] border border-[#D8D2C2] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFECE2] pb-4">
        <div>
          <div className="text-xs font-mono text-[#5C645C]">
            SÍNTESE VISUAL EDITORIAL · NANO BANANA PRO (gemini-3-pro-image · 16:9 · 2K)
          </div>
          <h3 className="font-display text-xl font-bold text-[#163024] mt-0.5">
            Infográfico Didático: {activeConcept.title}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => onGenerateInfographic(customFocusInput.trim() || undefined)}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#FDE047]" />
              <span>Gerando com gemini-3-pro-image...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4 text-[#FDE047]" />
              <span>Criar infográfico</span>
            </>
          )}
        </button>
      </div>

      {!infographic && !isGenerating && (
        <div className="space-y-2">
          <label
            htmlFor="infographic-focus-input"
            className="block text-xs font-semibold text-[#5C645C]"
          >
            Dúvida ou foco opcional para a direção visual do infográfico (ou clique direto em “Criar infográfico” / peça por voz ao tutor):
          </label>
          <input
            id="infographic-focus-input"
            type="text"
            value={customFocusInput}
            onChange={(e) => setCustomFocusInput(e.target.value)}
            placeholder={`Ex: Diferenciar o que cada observador vê em ${activeConcept.title}...`}
            className="w-full rounded-xl border border-[#D8D2C2] bg-white px-3.5 py-2 text-sm text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
          />
        </div>
      )}

      {isGenerating && (
        <div className="p-6 rounded-xl bg-[#F3EFE4] border border-[#D8D2C2] flex flex-col items-center justify-center text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#163024]" />
          <div className="font-semibold text-base text-[#163024]">
            Preparando direção visual e gerando infográfico 16:9 (2K) com Nano Banana Pro...
          </div>
          <p className="text-xs text-[#5C645C] max-w-md">
            A sessão de voz do Gemini Live permanece ativa enquanto a imagem é renderizada pela API real.
          </p>
        </div>
      )}

      {errorState && !isGenerating && (
        <div className="p-5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#BE123C] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono uppercase text-[#9F1239]">
                  Falha na API de Imagem · Categoria: {errorState.errorCategory || 'ERRO'} · Modelo:{' '}
                  {errorState.attemptedModel || 'gemini-3-pro-image'}
                </div>
                <p className="text-sm font-semibold text-[#881337] mt-1">
                  {errorState.userMessage}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onGenerateInfographic(customFocusInput.trim() || undefined)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>

          <div className="p-3 rounded-lg bg-white/80 border border-[#FECDD3] text-xs text-[#4C0519] space-y-1">
            <div className="font-semibold">
              Como configurar o acesso ao Nano Banana Pro (`gemini-3-pro-image`):
            </div>
            <p>
              O modelo de geração e edição de imagens em 2K (`gemini-3-pro-image`) exige uma chave de API vinculada a um projeto do Google Cloud com faturamento (Billing) ativo. Abra o painel <strong>Settings &gt; Secrets</strong> no AI Studio e selecione uma chave `GEMINI_API_KEY` com faturamento habilitado. Nenhuma imagem substituta ou simulada foi exibida.
            </p>
          </div>
        </div>
      )}

      {infographic && !isGenerating && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-[#F3EFE4] border border-[#D8D2C2] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5C645C]">
              <span>DIREÇÃO VISUAL APLICADA</span>
              <span>
                Modelo utilizado: <strong>{infographic.modelUsed}</strong> · Formato:{' '}
                {infographic.aspectRatio} · Resolução: {infographic.resolution}
              </span>
            </div>
            <div className="text-base font-bold text-[#163024]">
              {infographic.visualDirection.shortTitle}
            </div>
            <div className="text-xs text-[#2E382E]">
              <strong>Pergunta principal:</strong> {infographic.visualDirection.mainQuestion} ·{' '}
              <strong>Conclusão:</strong> {infographic.visualDirection.conclusion}
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-[#D8D2C2] bg-[#163024]">
            <img
              src={infographic.imageUrl}
              alt={`Infográfico gerado para ${infographic.conceptTitle}: ${infographic.visualDirection.shortTitle}`}
              referrerPolicy="no-referrer"
              className="w-full h-auto object-contain max-h-[520px] mx-auto cursor-zoom-in"
              onClick={() => setIsZoomOpen(true)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#163024] text-white text-xs">
              <span className="font-mono">
                Modelo real: {infographic.modelUsed} ({infographic.aspectRatio} ·{' '}
                {infographic.resolution})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ampliar imagem</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDE047] hover:bg-[#FACC15] text-[#163024] font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar resolução original</span>
                </button>
              </div>
            </div>
          </div>

          {infographic.visualReviewNotes && infographic.visualReviewNotes.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#78350F] space-y-1">
              <div className="font-bold">
                Orientação de revisão visual (apoio ao estudo — compare sempre com o esquema do quadro):
              </div>
              <ul className="space-y-1">
                {infographic.visualReviewNotes.map((note, idx) => (
                  <li key={idx}>• {note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <form
              onSubmit={handleAskTutorSubmit}
              className="p-4 rounded-xl bg-white border border-[#D8D2C2] space-y-2.5"
            >
              <label className="block text-xs font-bold text-[#163024]">
                Perguntar ao tutor sobre este infográfico
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tutorQuestionInput}
                  onChange={(e) => setTutorQuestionInput(e.target.value)}
                  placeholder="Ex: O que significa a região mais escura nesta imagem?"
                  className="flex-1 rounded-lg border border-[#D8D2C2] px-3 py-2 text-sm text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#163024] hover:bg-[#1E4231] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#FDE047]" />
                  <span>Perguntar ao tutor</span>
                </button>
              </div>
            </form>

            <form
              onSubmit={handleCorrectionSubmit}
              className="p-4 rounded-xl bg-white border border-[#D8D2C2] space-y-2.5"
            >
              <label className="block text-xs font-bold text-[#163024]">
                Solicitar correção específica na imagem (mantém o restante)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={correctionInput}
                  onChange={(e) => setCorrectionInput(e.target.value)}
                  placeholder="Ex: Aumentar o tamanho das legendas em português..."
                  className="flex-1 rounded-lg border border-[#D8D2C2] px-3 py-2 text-sm text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
                />
                <button
                  type="submit"
                  disabled={!correctionInput.trim() || isGenerating}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2E5A44] hover:bg-[#163024] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Aplicar correção</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isZoomOpen && infographic && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-6xl flex items-center justify-between text-white mb-3">
            <div>
              <h4 className="font-bold text-lg">{infographic.visualDirection.shortTitle}</h4>
              <p className="text-xs text-white/75 font-mono">
                Modelo: {infographic.modelUsed} · Resolução original {infographic.resolution} (
                {infographic.aspectRatio})
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FDE047] text-[#163024] text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar resolução original</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                aria-label="Fechar ampliação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="w-full max-w-6xl overflow-auto rounded-xl border border-white/20 bg-black">
            <img
              src={infographic.imageUrl}
              alt={infographic.visualDirection.shortTitle}
              referrerPolicy="no-referrer"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </section>
  );
};
