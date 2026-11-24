import React, { useState, useRef } from 'react';
import {
  X,
  Mic,
  Square,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { StudyConcept, EvaluationResult } from '../types';
import { parseApiResponse } from '../utils/pdfExtractor';

interface ExplainModalProps {
  isOpen: boolean;
  concept: StudyConcept;
  documentTitle: string;
  rawTextPreview: string;
  onClose: () => void;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({
  isOpen,
  concept,
  documentTitle,
  rawTextPreview,
  onClose,
}) => {
  const [explanationText, setExplanationText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const startVoiceRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const res = String(reader.result || '');
              const base64 = res.split(',')[1] || '';
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(audioBlob);
          const audioBase64 = await base64Promise;

          const resp = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: audioBlob.type || 'audio/webm',
            }),
          });
          const data = await parseApiResponse(resp);
          if (!resp.ok) {
            throw new Error(data.userMessage || 'Falha ao transcrever o áudio.');
          }
          if (data.transcript) {
            setExplanationText((prev) =>
              prev.trim() ? `${prev.trim()} ${data.transcript}` : data.transcript
            );
          }
        } catch (err) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Não foi possível transcrever o áudio gravado. Você também pode digitar ou editar sua explicação.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Autorize o microfone ou escreva sua resposta no campo abaixo.'
          : 'Não foi possível iniciar a gravação de voz.'
      );
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleEvaluate = async () => {
    if (!explanationText.trim()) {
      setErrorMsg('Escreva ou grave sua explicação antes de clicar em “Terminei minha explicação”.');
      return;
    }

    setErrorMsg(null);
    setIsEvaluating(true);
    try {
      const resp = await fetch('/api/evaluate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle,
          rawTextPreview,
          concept,
          studentExplanation: explanationText,
        }),
      });
      const data = await parseApiResponse(resp);
      if (!resp.ok) {
        throw new Error(data.userMessage || 'Erro ao avaliar sua explicação.');
      }
      setEvaluation(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível avaliar sua resposta agora. Tente novamente.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleTryAgain = () => {
    setEvaluation(null);
    setErrorMsg(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-modal-title"
    >
      <div className="bg-[#FFFDF8] border border-[#D8D2C2] rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE2] pb-4">
          <div>
            <div className="text-xs font-mono text-[#2E5A44] uppercase tracking-wider">
              Atividade de Fixação · {concept.sourceReference}
            </div>
            <h3
              id="explain-modal-title"
              className="font-display text-2xl font-bold text-[#163024] mt-1"
            >
              Agora eu explico: {concept.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#5C645C] hover:text-[#1E241E] hover:bg-[#F3EFE4] transition-colors cursor-pointer"
            aria-label="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#F3EFE4] border border-[#D8D2C2]">
          <div className="text-xs font-semibold text-[#5C645C] mb-1">
            Pergunta aberta (explique com suas próprias palavras):
          </div>
          <p className="text-lg font-semibold text-[#163024] leading-snug">
            {concept.openQuestionPrompt}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="student-explanation-textarea"
              className="text-sm font-semibold text-[#1E241E]"
            >
              Sua explicação (você pode gravar por voz e editar a transcrição abaixo):
            </label>

            {!isRecording ? (
              <button
                type="button"
                onClick={startVoiceRecording}
                disabled={isTranscribing || isEvaluating}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Mic className="w-3.5 h-3.5 text-[#FDE047]" />
                <span>Responder por voz</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Parar gravação e transcrever</span>
              </button>
            )}
          </div>

          {isTranscribing && (
            <div className="flex items-center gap-2 text-xs text-[#0369A1] font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Transcrevendo sua fala com gemini-3.5-transcribe...</span>
            </div>
          )}

          <textarea
            id="student-explanation-textarea"
            rows={5}
            value={explanationText}
            onChange={(e) => setExplanationText(e.target.value)}
            placeholder="Explique aqui com suas próprias palavras como este conceito funciona..."
            className="w-full rounded-xl border border-[#D8D2C2] bg-white p-4 text-base text-[#1E241E] focus:outline-none focus:ring-2 focus:ring-[#163024]"
          />
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-sm text-[#9F1239]">
            {errorMsg}
          </div>
        )}

        {evaluation ? (
          <div className="space-y-4 pt-2 border-t border-[#EFECE2]">
            <h4 className="font-display text-lg font-bold text-[#163024]">
              Avaliação da sua explicação
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
                <div className="flex items-center gap-2 font-bold text-sm text-[#065F46] mb-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>O que você entendeu corretamente</span>
                </div>
                {evaluation.understoodCorrectly.length === 0 ? (
                  <p className="text-sm text-[#065F46]/80">
                    Sua resposta ainda não abordou os pontos centrais deste conceito no material.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-[#064E3B]">
                    {evaluation.understoodCorrectly.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
                <div className="flex items-center gap-2 font-bold text-sm text-[#92400E] mb-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>O que faltou ou pode ser ajustado</span>
                </div>
                {evaluation.missingOrConfused.length === 0 ? (
                  <p className="text-sm text-[#92400E]/80">
                    Nenhum erro conceitual identificado em relação ao documento!
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-[#78350F]">
                    {evaluation.missingOrConfused.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#D8D2C2] space-y-1.5">
              <div className="text-xs font-mono uppercase text-[#5C645C]">
                Correção breve e específica:
              </div>
              <p className="text-base text-[#1E241E] leading-relaxed">
                {evaluation.specificCorrection}
              </p>
              {evaluation.encouragementNote && (
                <p className="text-sm text-[#2E5A44] font-medium pt-1">
                  Dica de revisão: {evaluation.encouragementNote}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D8D2C2] bg-white hover:bg-[#F3EFE4] text-sm font-semibold text-[#1E241E] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white text-sm font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao quadro para revisar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D8D2C2] bg-white hover:bg-[#F3EFE4] text-sm font-semibold text-[#1E241E] cursor-pointer"
            >
              Voltar ao quadro
            </button>

            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating || isRecording || isTranscribing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Avaliando sua explicação...</span>
                </>
              ) : (
                <span>Terminei minha explicação</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
