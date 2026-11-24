import React, { useState, useCallback } from 'react';
import {
  FileText,
  Upload,
  BookOpen,
  MessageCircle,
  Send,
  RotateCcw,
  Eye,
  GraduationCap,
  AlertCircle,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import {
  StudyMaterialAnalysis,
  StudyConcept,
  TutorQATurn,
  GeneratedInfographic,
} from './types';
import { SAMPLE_DOCUMENTS, SampleDocument } from './sampleDocuments';
import { ChalkboardStage } from './components/ChalkboardStage';
import { LiveTutorBar } from './components/LiveTutorBar';
import { ExplainModal } from './components/ExplainModal';
import { InfographicStudio } from './components/InfographicStudio';
import {
  extractPdfContentClientSide,
  ExtractedPdfContent,
  parseApiResponse,
} from './utils/pdfExtractor';

const PEDAGOGICAL_SHORTCUTS = [
  'Não entendi esta parte',
  'Explique de outra maneira',
  'Dê um exemplo do dia a dia',
  'O que acontece se mudarmos isso?',
];

export default function App() {
  // Document upload / paste state
  const [inputMode, setInputMode] = useState<'pdf' | 'notes'>('pdf');
  const [pdfFile, setPdfFile] = useState<{
    name: string;
    base64?: string;
    extracted?: ExtractedPdfContent;
    sizeKb: number;
  } | null>(null);
  const [pdfLoadingProgress, setPdfLoadingProgress] = useState<string | null>(null);
  const [pastedNotes, setPastedNotes] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  // Analysis & Study Room State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [studyMaterial, setStudyMaterial] = useState<StudyMaterialAnalysis | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);

  // Below-board Q&A and Shortcuts State
  const [questionInput, setQuestionInput] = useState('');
  const [isAskingBoard, setIsAskingBoard] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [qaHistoryByConcept, setQaHistoryByConcept] = useState<Record<string, TutorQATurn[]>>({});

  // Modals ("Ver anotações originais" & "Agora eu explico")
  const [isOriginalNotesOpen, setIsOriginalNotesOpen] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  // Infographic State per concept
  const [infographicsByConcept, setInfographicsByConcept] = useState<
    Record<string, GeneratedInfographic>
  >({});
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
  const [infographicError, setInfographicError] = useState<{
    userMessage: string;
    errorCategory?: string;
    attemptedModel?: string;
    technicalDetails?: string;
  } | null>(null);

  const activeConcept: StudyConcept | null =
    studyMaterial?.concepts.find((c) => c.id === activeConceptId) ||
    studyMaterial?.concepts[0] ||
    null;

  const activeInfographic: GeneratedInfographic | null = activeConcept
    ? infographicsByConcept[activeConcept.id] || null
    : null;

  const currentConceptHistory: TutorQATurn[] = activeConcept
    ? qaHistoryByConcept[activeConcept.id] || []
    : [];

  // Reset entire study context when switching material
  const resetStudyContext = () => {
    setStudyMaterial(null);
    setActiveConceptId(null);
    setHighlightedElement(null);
    setQaHistoryByConcept({});
    setInfographicsByConcept({});
    setInfographicError(null);
    setBoardError(null);
    setAnalysisError(null);
    setIsOriginalNotesOpen(false);
    setIsExplainModalOpen(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setAnalysisError('Por favor, selecione um arquivo no formato PDF (.pdf).');
      return;
    }

    setAnalysisError(null);
    setSelectedSampleId(null);
    const sizeKb = Math.round(file.size / 1024);

    // Extract text per page + compressed page figure snapshots on the client
    // so even large PDFs never trigger HTTP 413 HTML errors from Cloud Run / proxies
    setPdfLoadingProgress('Processando páginas e figuras do PDF...');
    try {
      const extracted = await extractPdfContentClientSide(file, (status) =>
        setPdfLoadingProgress(status)
      );

      // If the raw PDF is small (< 1.5 MB), also keep the raw base64
      let rawBase64: string | undefined = undefined;
      if (file.size < 1_500_000) {
        rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const resultStr = String(reader.result || '');
            resolve(resultStr.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setPdfFile({
        name: file.name,
        base64: rawBase64,
        extracted,
        sizeKb,
      });
    } catch {
      // Fallback to raw base64 if under 3.5MB
      if (file.size <= 3_500_000) {
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = String(reader.result || '');
          const base64 = resultStr.split(',')[1] || '';
          setPdfFile({
            name: file.name,
            base64,
            sizeKb,
          });
        };
        reader.onerror = () => {
          setAnalysisError('Erro ao ler o arquivo PDF local. Tente novamente.');
        };
        reader.readAsDataURL(file);
      } else {
        setAnalysisError(
          'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido ou protegido por senha.'
        );
      }
    } finally {
      setPdfLoadingProgress(null);
    }
  };

  const handleLoadSampleIntoEditor = (sample: SampleDocument) => {
    setSelectedSampleId(sample.id);
    setInputMode('notes');
    setPastedTitle(sample.title);
    setPastedNotes(sample.rawText);
    setPdfFile(null);
    setAnalysisError(null);
  };

  const handleStartLessonWithDocument = async () => {
    setAnalysisError(null);

    if (inputMode === 'pdf' && !pdfFile) {
      setAnalysisError('Selecione um arquivo PDF antes de clicar em “Começar aula com este documento”.');
      return;
    }
    if (inputMode === 'notes' && !pastedNotes.trim()) {
      setAnalysisError('Cole suas anotações de estudo antes de clicar em “Começar aula com este documento”.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const payload =
        inputMode === 'pdf' && pdfFile
          ? {
              pdfBase64: pdfFile.base64,
              rawText: pdfFile.extracted?.extractedTextWithPages,
              pageSnapshots: pdfFile.base64 ? undefined : pdfFile.extracted?.pageSnapshots,
              fileName: pdfFile.name,
              sourceType: 'pdf' as const,
            }
          : {
              rawText: pastedNotes,
              fileName: pastedTitle.trim() || 'Anotações de Estudo',
              sourceType: selectedSampleId ? ('sample' as const) : ('notes' as const),
            };

      const resp = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse(resp);
      if (!resp.ok) {
        throw new Error(
          data.userMessage || 'Não foi possível analisar o documento. Tente novamente.'
        );
      }

      // Reset old material state completely so materials never mix
      setQaHistoryByConcept({});
      setInfographicsByConcept({});
      setInfographicError(null);
      setHighlightedElement(null);
      setStudyMaterial(data);
      setActiveConceptId(data.concepts?.[0]?.id || null);
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao analisar o documento. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskBoardQuestion = async (questionText: string, shortcutLabel?: string) => {
    if (!studyMaterial || !activeConcept || !questionText.trim() || isAskingBoard) return;

    setBoardError(null);
    setIsAskingBoard(true);

    const contextualQuestion =
      highlightedElement && shortcutLabel
        ? `${questionText} (Foco na parte destacada no quadro: "${highlightedElement}")`
        : questionText.trim();

    const studentTurn: TutorQATurn = {
      id: `turn_${Date.now()}_s`,
      role: 'student',
      text: contextualQuestion,
      shortcutLabel,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const existingTurns = qaHistoryByConcept[activeConcept.id] || [];
    const updatedTurns = [...existingTurns, studentTurn];

    setQaHistoryByConcept((prev) => ({
      ...prev,
      [activeConcept.id]: updatedTurns,
    }));
    setQuestionInput('');

    try {
      const resp = await fetch('/api/board-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: studyMaterial.documentTitle,
          executiveSummary: studyMaterial.executiveSummary,
          rawTextPreview: studyMaterial.rawTextPreview,
          concept: activeConcept,
          question: contextualQuestion,
          shortcutType: shortcutLabel,
          conversationHistory: updatedTurns,
          activeInfographic,
        }),
      });

      const data = await parseApiResponse(resp);
      if (!resp.ok) {
        throw new Error(data.userMessage || 'Não foi possível obter a resposta do tutor.');
      }

      if (data.highlightElementId) {
        setHighlightedElement(data.highlightElementId);
      }

      if (data.shouldUpdateBoard && data.updatedRepresentation) {
        setStudyMaterial((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            concepts: prev.concepts.map((c) =>
              c.id === activeConcept.id
                ? {
                    ...c,
                    representation: {
                      ...c.representation,
                      ...data.updatedRepresentation,
                      // Preserve verified diagram preset if the concept uses one
                      diagramPreset:
                        c.representation.diagramPreset ||
                        data.updatedRepresentation.diagramPreset,
                    },
                  }
                : c
            ),
          };
        });
      }

      const tutorTurn: TutorQATurn = {
        id: `turn_${Date.now()}_t`,
        role: 'tutor',
        text: data.tutorAnswer,
        boardUpdated: Boolean(data.shouldUpdateBoard && data.updatedRepresentation),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setQaHistoryByConcept((prev) => ({
        ...prev,
        [activeConcept.id]: [...(prev[activeConcept.id] || []), tutorTurn],
      }));
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : 'Erro ao consultar o tutor sobre este conceito.'
      );
    } finally {
      setIsAskingBoard(false);
    }
  };

  // Shared real Nano Banana Pro (gemini-3-pro-image) generation function used by both Button and Live Voice Tool
  const triggerNanoBananaInfographic = useCallback(
    async (
      customFocus?: string,
      correctionInstruction?: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!studyMaterial || !activeConcept) {
        return { success: false, error: 'Nenhum conceito ativo selecionado.' };
      }

      setInfographicError(null);
      setIsGeneratingInfographic(true);

      try {
        const existingInfographic = infographicsByConcept[activeConcept.id];

        const resp = await fetch('/api/infographic/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentTitle: studyMaterial.documentTitle,
            rawTextPreview: studyMaterial.rawTextPreview,
            concept: activeConcept,
            studentDoubtOrFocus: customFocus,
            existingImageBase64: correctionInstruction
              ? existingInfographic?.imageUrl
              : undefined,
            existingImageMimeType: correctionInstruction
              ? existingInfographic?.mimeType
              : undefined,
            correctionInstruction,
            existingVisualDirection: correctionInstruction
              ? existingInfographic?.visualDirection
              : undefined,
          }),
        });

        const data = await parseApiResponse(resp);
        if (!resp.ok) {
          setInfographicError({
            userMessage:
              data.userMessage || 'Falha ao gerar o infográfico com gemini-3-pro-image.',
            errorCategory: data.errorCategory,
            attemptedModel: data.attemptedModel || 'gemini-3-pro-image',
            technicalDetails: data.technicalDetails,
          });
          return {
            success: false,
            error: data.userMessage || 'Erro na chamada ao modelo gemini-3-pro-image.',
          };
        }

        const newInfographic: GeneratedInfographic = {
          id: `info_${Date.now()}`,
          conceptId: activeConcept.id,
          conceptTitle: activeConcept.title,
          imageUrl: data.imageUrl,
          mimeType: data.mimeType,
          modelUsed: data.modelUsed,
          aspectRatio: data.aspectRatio,
          resolution: data.resolution,
          visualDirection: data.visualDirection,
          visualReviewNotes: data.visualReviewNotes,
          createdAt: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setInfographicsByConcept((prev) => ({
          ...prev,
          [activeConcept.id]: newInfographic,
        }));

        return { success: true };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao conectar com o gerador de infográficos.';
        setInfographicError({
          userMessage: msg,
          errorCategory: 'NETWORK_OR_SERVER',
          attemptedModel: 'gemini-3-pro-image',
        });
        return { success: false, error: msg };
      } finally {
        setIsGeneratingInfographic(false);
      }
    },
    [studyMaterial, activeConcept, infographicsByConcept]
  );

  // Live Tool Call Handlers connected to real UI components
  const handleSelectConceptFromLive = useCallback(
    (idOrTitle: string) => {
      if (!studyMaterial) return { success: false };
      const norm = idOrTitle.toLowerCase().trim();
      const matched = studyMaterial.concepts.find(
        (c) =>
          c.id.toLowerCase() === norm ||
          c.title.toLowerCase().includes(norm) ||
          norm.includes(c.title.toLowerCase())
      );
      if (matched) {
        setActiveConceptId(matched.id);
        setHighlightedElement(null);
        return { success: true, matchedTitle: matched.title };
      }
      return { success: false };
    },
    [studyMaterial]
  );

  const handleHighlightFromLive = useCallback((elementIdOrLabel: string) => {
    setHighlightedElement(elementIdOrLabel);
    return { success: true, highlighted: elementIdOrLabel };
  }, []);

  const handleUpdateBoardFromLive = useCallback(
    (update: {
      newGuidingQuestion: string;
      newTakeaway: string;
      addedAnnotationLabel?: string;
      addedAnnotationDetail?: string;
      addedAnnotationColor?: 'yellow' | 'blue' | 'coral' | 'white';
    }) => {
      if (!activeConcept) return { success: false };

      setStudyMaterial((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          concepts: prev.concepts.map((c) => {
            if (c.id !== activeConcept.id) return c;
            const nextAnnotations = [...(c.representation.annotations || [])];
            if (update.addedAnnotationLabel && update.addedAnnotationDetail) {
              nextAnnotations.push({
                id: `live_note_${Date.now()}`,
                label: update.addedAnnotationLabel,
                detail: update.addedAnnotationDetail,
                color: update.addedAnnotationColor || 'yellow',
              });
            }
            return {
              ...c,
              representation: {
                ...c.representation,
                guidingQuestion:
                  update.newGuidingQuestion || c.representation.guidingQuestion,
                takeaway: update.newTakeaway || c.representation.takeaway,
                annotations: nextAnnotations,
              },
            };
          }),
        };
      });

      return { success: true };
    },
    [activeConcept]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Persistent Sticky Top Bar with Gemini Live Voice Tutor Controls */}
      <LiveTutorBar
        studyMaterial={studyMaterial}
        activeConcept={activeConcept}
        highlightedElement={highlightedElement}
        activeInfographic={activeInfographic}
        onSelectConceptByIdOrTitle={handleSelectConceptFromLive}
        onHighlightElement={handleHighlightFromLive}
        onUpdateBoardFromLive={handleUpdateBoardFromLive}
        onTriggerInfographicFromLive={(focus) => triggerNanoBananaInfographic(focus)}
      />

      {/* VIEW 1: Document Setup / Start Lesson Screen */}
      {!studyMaterial ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-[#2E5A44]">
              Ambiente Interativo de Estudos · Quadro Visual + Caderno + Voz em Tempo Real
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#163024] tracking-tight">
              Prepare sua aula a partir de um PDF ou de suas anotações
            </h1>
            <p className="text-base sm:text-lg text-[#3D463D] max-w-3xl leading-relaxed">
              Envie seu documento de estudo ou cole suas anotações. O aplicativo analisa o conteúdo real (incluindo figuras e páginas), constrói esquemas visuais no quadro verde e organiza seu caderno de conceitos.
            </p>
          </div>

          {/* Primary User Upload / Paste Card */}
          <div className="bg-[#FFFDF8] border border-[#D8D2C2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE2] pb-4">
              <h2 className="font-display text-xl font-bold text-[#163024]">
                1. Seu Material de Estudo
              </h2>

              {/* Segmented Toggle: PDF vs Pasted Notes */}
              <div className="flex items-center gap-1 p-1 bg-[#F3EFE4] rounded-xl border border-[#D8D2C2]">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('pdf');
                    setSelectedSampleId(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    inputMode === 'pdf'
                      ? 'bg-[#163024] text-white shadow-xs'
                      : 'text-[#3D463D] hover:text-[#163024]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Enviar arquivo PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('notes')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    inputMode === 'notes'
                      ? 'bg-[#163024] text-white shadow-xs'
                      : 'text-[#3D463D] hover:text-[#163024]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Colar anotações em texto</span>
                </button>
              </div>
            </div>

            {inputMode === 'pdf' ? (
              <div className="space-y-4">
                <label
                  htmlFor="pdf-upload-input"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-[#B8B09C] hover:border-[#163024] rounded-2xl p-8 sm:p-10 bg-[#F9F6EE]/60 cursor-pointer transition-colors text-center"
                >
                  <Upload className="w-10 h-10 text-[#2E5A44] mb-3" />
                  <span className="text-base font-bold text-[#163024]">
                    Clique para escolher um arquivo PDF do seu dispositivo
                  </span>
                  <span className="text-sm text-[#5C645C] mt-1">
                    Analisa o texto real, figuras, diagramas e referências de página do PDF
                  </span>
                  <input
                    id="pdf-upload-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </label>

                {pdfLoadingProgress && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#F3EFE4] border border-[#D8D2C2] text-sm text-[#163024] font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2E5A44]" />
                    <span>{pdfLoadingProgress}</span>
                  </div>
                )}

                {pdfFile && !pdfLoadingProgress && (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="font-bold text-sm">{pdfFile.name}</div>
                        <div className="text-xs opacity-80">
                          Arquivo carregado ({pdfFile.sizeKb} KB
                          {pdfFile.extracted
                            ? ` · ${pdfFile.extracted.totalPages} página(s) extraída(s)`
                            : ''}
                          ) · Pronto para análise
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="text-xs font-semibold underline hover:text-[#047857] cursor-pointer"
                    >
                      Remover arquivo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedSampleId && (
                  <div className="p-3 rounded-xl bg-[#FEF9C3] border border-[#FDE047] text-xs text-[#713F12] flex items-center justify-between">
                    <span>
                      <strong>Material de exemplo carregado no editor.</strong> Você pode editar o texto livremente ou clicar em “Começar aula com este documento”.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSampleId(null);
                        setPastedTitle('');
                        setPastedNotes('');
                      }}
                      className="underline font-semibold ml-2 cursor-pointer"
                    >
                      Limpar exemplo
                    </button>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="notes-title-input"
                    className="block text-xs font-bold uppercase tracking-wider text-[#5C645C] mb-1.5"
                  >
                    Título do material ou tema (opcional)
                  </label>
                  <input
                    id="notes-title-input"
                    type="text"
                    value={pastedTitle}
                    onChange={(e) => setPastedTitle(e.target.value)}
                    placeholder="Ex: Resumo de Óptica Geométrica / Fisiologia Vegetal..."
                    className="w-full rounded-xl border border-[#D8D2C2] bg-white px-4 py-2.5 text-base text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notes-content-textarea"
                    className="block text-xs font-bold uppercase tracking-wider text-[#5C645C] mb-1.5"
                  >
                    Anotações de estudo coladas como texto
                  </label>
                  <textarea
                    id="notes-content-textarea"
                    rows={8}
                    value={pastedNotes}
                    onChange={(e) => {
                      setPastedNotes(e.target.value);
                      setSelectedSampleId(null);
                    }}
                    placeholder="Cole aqui suas anotações de aula, capítulos ou textos de estudo..."
                    className="w-full rounded-xl border border-[#D8D2C2] bg-white p-4 text-base text-[#1E241E] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#163024]"
                  />
                </div>
              </div>
            )}

            {/* Real Error Banner with Retry Option */}
            {analysisError && (
              <div className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#9F1239]">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Não foi possível analisar o documento</div>
                    <p className="mt-0.5">{analysisError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartLessonWithDocument}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            )}

            {/* Primary CTA: Começar aula com este documento */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleStartLessonWithDocument}
                disabled={isAnalyzing}
                className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white font-bold text-base shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#FDE047]" />
                    <span>Analisando conteúdo real do documento...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-5 h-5 text-[#FDE047]" />
                    <span>Começar aula com este documento</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Clearly Separated & Identified Sample Materials Section */}
          <div className="bg-[#F3EFE4]/80 border border-[#D8D2C2] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#5C645C]">
                  MATERIAIS DE EXEMPLO (SEPARADOS DOS SEUS ARQUIVOS ENVIADOS)
                </div>
                <h3 className="font-display text-lg font-bold text-[#163024]">
                  Quer testar a sala de aula com temas científicos diferentes?
                </h3>
              </div>
              <span className="text-xs text-[#5C645C]">
                Cada exemplo passa pela análise real da API ao iniciar a aula
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SAMPLE_DOCUMENTS.map((sample) => {
                const isSelected = selectedSampleId === sample.id;
                return (
                  <div
                    key={sample.id}
                    className={`p-5 rounded-xl border transition-all flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-white border-[#163024] ring-2 ring-[#163024]'
                        : 'bg-[#FFFDF8] border-[#D8D2C2]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono text-[#2E5A44]">
                        Material de Exemplo · {sample.subjectTag}
                      </div>
                      <h4 className="font-display text-lg font-bold text-[#163024]">
                        {sample.title}
                      </h4>
                      <p className="text-sm text-[#3D463D] leading-relaxed">
                        {sample.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#EFECE2]">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleIntoEditor(sample)}
                        className="text-sm font-bold text-[#163024] hover:underline cursor-pointer"
                      >
                        {isSelected
                          ? '✓ Carregado no campo de texto acima'
                          : 'Carregar este exemplo no editor'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      ) : (
        /* VIEW 2: Active Classroom (Chalkboard Stage Left + Study Notebook Right) */
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT / MAIN ZONE (8 cols): Chalkboard + Pedagogical Shortcuts + Infographic Studio */}
            <div className="lg:col-span-8 space-y-6">
              {activeConcept && (
                <>
                  {/* Main Green Chalkboard */}
                  <ChalkboardStage
                    representation={activeConcept.representation}
                    highlightedElementId={highlightedElement}
                    onSelectElement={(idOrLabel) =>
                      setHighlightedElement((prev) =>
                        prev === idOrLabel ? null : idOrLabel
                      )
                    }
                  />

                  {/* Below Chalkboard: Question Box & 4 Mandatory Pedagogical Shortcuts */}
                  <section className="bg-[#FFFDF8] border border-[#D8D2C2] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-lg font-bold text-[#163024]">
                          Dúvidas sobre o quadro: {activeConcept.title}
                        </h3>
                        <p className="text-xs text-[#5C645C]">
                          {highlightedElement
                            ? `Parte selecionada no quadro: "${highlightedElement}" (clique nos atalhos para perguntar sobre ela)`
                            : 'Use um atalho rápido ou escreva sua pergunta de acompanhamento abaixo'}
                        </p>
                      </div>
                      {highlightedElement && (
                        <button
                          type="button"
                          onClick={() => setHighlightedElement(null)}
                          className="text-xs font-semibold text-[#2E5A44] underline cursor-pointer"
                        >
                          Limpar seleção ({highlightedElement})
                        </button>
                      )}
                    </div>

                    {/* 4 Pedagogical Shortcuts */}
                    <div className="flex flex-wrap gap-2">
                      {PEDAGOGICAL_SHORTCUTS.map((shortcut) => (
                        <button
                          key={shortcut}
                          type="button"
                          disabled={isAskingBoard}
                          onClick={() => handleAskBoardQuestion(shortcut, shortcut)}
                          className="px-3.5 py-2 rounded-xl border border-[#D8D2C2] bg-[#F3EFE4] hover:bg-[#163024] hover:text-white hover:border-[#163024] text-sm font-semibold text-[#163024] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {shortcut}
                        </button>
                      ))}
                    </div>

                    {/* Written Question Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAskBoardQuestion(questionInput);
                      }}
                      className="flex gap-2.5"
                    >
                      <input
                        type="text"
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        disabled={isAskingBoard}
                        placeholder={`Escreva uma pergunta sobre ${activeConcept.title}...`}
                        className="flex-1 rounded-xl border border-[#D8D2C2] bg-white px-4 py-2.5 text-base text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
                      />
                      <button
                        type="submit"
                        disabled={isAskingBoard || !questionInput.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isAskingBoard ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#FDE047]" />
                            <span>Consultando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-[#FDE047]" />
                            <span>Perguntar</span>
                          </>
                        )}
                      </button>
                    </form>

                    {boardError && (
                      <div className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-sm text-[#9F1239]">
                        {boardError}
                      </div>
                    )}

                    {/* Preserved Follow-Up Conversation History for this Concept */}
                    {currentConceptHistory.length > 0 && (
                      <div className="pt-3 border-t border-[#EFECE2] space-y-3 max-h-80 overflow-y-auto">
                        {currentConceptHistory.map((turn) => (
                          <div
                            key={turn.id}
                            className={`p-4 rounded-xl text-base leading-relaxed ${
                              turn.role === 'student'
                                ? 'bg-[#F3EFE4] text-[#1E241E] ml-4'
                                : 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#064E3B] mr-4'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-mono opacity-75 mb-1">
                              <span>
                                {turn.role === 'student' ? 'Você perguntou' : 'Resposta do Tutor'}
                                {turn.shortcutLabel ? ` · Atalho: ${turn.shortcutLabel}` : ''}
                              </span>
                              <span>
                                {turn.boardUpdated ? '✓ Quadro atualizado · ' : ''}
                                {turn.timestamp}
                              </span>
                            </div>
                            <p className="whitespace-pre-line">{turn.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Nano Banana Pro Infographic Section */}
                  <InfographicStudio
                    activeConcept={activeConcept}
                    infographic={activeInfographic}
                    isGenerating={isGeneratingInfographic}
                    errorState={infographicError}
                    onGenerateInfographic={(focus) => triggerNanoBananaInfographic(focus)}
                    onEditInfographic={(instruction) =>
                      triggerNanoBananaInfographic(undefined, instruction)
                    }
                    onAskTutorAboutInfographic={(q) =>
                      handleAskBoardQuestion(q, 'Pergunta sobre o infográfico')
                    }
                  />
                </>
              )}
            </div>

            {/* RIGHT ZONE (4 cols): Caderno de Estudos (Study Notebook) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
              <div className="notebook-paper border border-[#D8D2C2] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                {/* Notebook Header & Actions */}
                <div className="border-b border-[#D8D2C2] pb-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-[#5C645C]">
                    <span>CADERNO DE ESTUDOS</span>
                    <span>
                      {studyMaterial.sourceType === 'pdf'
                        ? 'PDF Enviado'
                        : studyMaterial.sourceType === 'sample'
                        ? 'Material de Exemplo'
                        : 'Anotações'}
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#163024] leading-snug">
                    {studyMaterial.documentTitle}
                  </h2>

                  {/* Action Buttons: Ver anotações originais & Trocar material */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsOriginalNotesOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D2C2] bg-white hover:bg-[#F3EFE4] text-xs font-semibold text-[#1E241E] transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#2E5A44]" />
                      <span>Ver anotações originais</span>
                    </button>

                    <button
                      type="button"
                      onClick={resetStudyContext}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D2C2] bg-white hover:bg-[#FFF1F2] hover:border-[#FECDD3] hover:text-[#BE123C] text-xs font-semibold text-[#1E241E] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Trocar material</span>
                    </button>
                  </div>
                </div>

                {/* Brief Executive Summary */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#5C645C]">
                    Resumo do Material
                  </div>
                  <p className="text-sm text-[#2E382E] leading-relaxed bg-white/80 p-3.5 rounded-xl border border-[#EFECE2]">
                    {studyMaterial.executiveSummary}
                  </p>
                </div>

                {/* Prominent "Agora eu explico" Button for the Selected Concept */}
                {activeConcept && (
                  <div className="p-4 rounded-xl bg-[#163024] text-white space-y-2.5">
                    <div className="text-xs font-mono text-[#FDE047]">
                      VERIFICAÇÃO DE APRENDIZAGEM
                    </div>
                    <p className="text-sm text-white/90 leading-snug">
                      Explique <strong>{activeConcept.title}</strong> com suas próprias palavras por voz ou texto para receber uma avaliação criteriosa.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsExplainModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FDE047] hover:bg-[#FACC15] text-[#163024] font-bold text-sm transition-colors cursor-pointer"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Agora eu explico</span>
                    </button>
                  </div>
                )}

                {/* List of Concepts with Page/Section Reference */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#5C645C]">
                    <span>Conceitos Principais ({studyMaterial.concepts.length})</span>
                    <span>Referência</span>
                  </div>

                  <div className="space-y-2.5">
                    {studyMaterial.concepts.map((concept, index) => {
                      const isSelected = activeConcept?.id === concept.id;
                      return (
                        <button
                          key={concept.id}
                          type="button"
                          onClick={() => {
                            setActiveConceptId(concept.id);
                            setHighlightedElement(null);
                            setInfographicError(null);
                          }}
                          className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#163024] text-white border-[#163024] shadow-sm'
                              : 'bg-white/90 hover:bg-white text-[#1E241E] border-[#D8D2C2]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-mono mb-1">
                            <span className={isSelected ? 'text-[#FDE047]' : 'text-[#2E5A44]'}>
                              Conceito {index + 1}
                            </span>
                            <span className={isSelected ? 'text-[#7DD3FC]' : 'text-[#5C645C]'}>
                              {concept.sourceReference}
                            </span>
                          </div>
                          <div className="font-bold text-base leading-snug mb-1">
                            {concept.title}
                          </div>
                          <p
                            className={`text-xs leading-relaxed ${
                              isSelected ? 'text-white/85' : 'text-[#5C645C]'
                            }`}
                          >
                            {concept.shortSummary}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Concept Detailed Notes inside the Notebook */}
                {activeConcept && (
                  <div className="pt-4 border-t border-[#D8D2C2] space-y-2">
                    <div className="text-xs font-mono text-[#2E5A44]">
                      ANOTAÇÃO DETALHADA · {activeConcept.sourceReference}
                    </div>
                    <h4 className="font-bold text-base text-[#163024]">
                      {activeConcept.title}
                    </h4>
                    <p className="text-sm text-[#2E382E] leading-relaxed">
                      {activeConcept.detailedExplanation}
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      )}

      {/* Modal: Ver anotações originais */}
      {isOriginalNotesOpen && studyMaterial && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#FFFDF8] border border-[#D8D2C2] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-[#EFECE2] pb-4 mb-4">
              <div>
                <div className="text-xs font-mono text-[#5C645C]">
                  DOCUMENTO DE ORIGEM · {studyMaterial.hasPageNumbers ? 'COM PÁGINAS' : 'SEÇÕES DE TEXTO'}
                </div>
                <h3 className="font-display text-xl font-bold text-[#163024]">
                  Anotações Originais: {studyMaterial.documentTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOriginalNotesOpen(false)}
                className="p-2 rounded-lg text-[#5C645C] hover:text-[#1E241E] hover:bg-[#F3EFE4] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-white border border-[#D8D2C2] font-mono text-sm text-[#1E241E] whitespace-pre-wrap leading-relaxed">
              {studyMaterial.rawTextPreview ||
                'Conteúdo extraído do PDF analisado disponível nas referências de conceitos.'}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agora eu explico */}
      {activeConcept && studyMaterial && (
        <ExplainModal
          isOpen={isExplainModalOpen}
          concept={activeConcept}
          documentTitle={studyMaterial.documentTitle}
          rawTextPreview={studyMaterial.rawTextPreview}
          onClose={() => setIsExplainModalOpen(false)}
        />
      )}
    </div>
  );
}
