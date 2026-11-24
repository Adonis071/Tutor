import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { StudyConcept, StudyMaterialAnalysis, GeneratedInfographic } from '../types';

export type LiveConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'responding'
  | 'error';

export interface LiveTranscriptEntry {
  id: string;
  speaker: 'student' | 'tutor' | 'system';
  text: string;
}

interface LiveTutorBarProps {
  studyMaterial: StudyMaterialAnalysis | null;
  activeConcept: StudyConcept | null;
  highlightedElement: string | null;
  activeInfographic: GeneratedInfographic | null;
  onSelectConceptByIdOrTitle: (idOrTitle: string) => { success: boolean; matchedTitle?: string };
  onHighlightElement: (elementIdOrLabel: string) => { success: boolean; highlighted: string };
  onUpdateBoardFromLive: (update: {
    newGuidingQuestion: string;
    newTakeaway: string;
    addedAnnotationLabel?: string;
    addedAnnotationDetail?: string;
    addedAnnotationColor?: 'yellow' | 'blue' | 'coral' | 'white';
  }) => { success: boolean };
  onTriggerInfographicFromLive: (focusQuestion: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

function float32ToPcm16Base64(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32Array(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }
  return float32;
}

export const LiveTutorBar: React.FC<LiveTutorBarProps> = ({
  studyMaterial,
  activeConcept,
  highlightedElement,
  activeInfographic,
  onSelectConceptByIdOrTitle,
  onHighlightElement,
  onUpdateBoardFromLive,
  onTriggerInfographicFromLive,
}) => {
  const [liveState, setLiveState] = useState<LiveConnectionState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef(false);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastSentConceptIdRef = useRef<string | null>(null);
  const lastSentInfographicIdRef = useRef<string | null>(null);

  // Keep callbacks fresh in refs for WebSocket tool call handler
  const callbacksRef = useRef({
    onSelectConceptByIdOrTitle,
    onHighlightElement,
    onUpdateBoardFromLive,
    onTriggerInfographicFromLive,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectConceptByIdOrTitle,
      onHighlightElement,
      onUpdateBoardFromLive,
      onTriggerInfographicFromLive,
    };
  }, [
    onSelectConceptByIdOrTitle,
    onHighlightElement,
    onUpdateBoardFromLive,
    onTriggerInfographicFromLive,
  ]);

  const stopAllPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped source
      }
    }
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  const cleanupSession = useCallback(() => {
    stopAllPlayback();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopAllPlayback]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  const appendTranscript = useCallback(
    (speaker: 'student' | 'tutor' | 'system', text: string) => {
      if (!text.trim()) return;
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === speaker && speaker !== 'system') {
          return [
            ...prev.slice(0, -1),
            { ...last, text: `${last.text} ${text.trim()}`.replace(/\s+/g, ' ') },
          ];
        }
        return [
          ...prev,
          { id: `${Date.now()}_${Math.random()}`, speaker, text: text.trim() },
        ];
      });
    },
    []
  );

  // Synchronize concept navigation or user selections to active Live session
  useEffect(() => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      activeConcept &&
      studyMaterial
    ) {
      if (lastSentConceptIdRef.current !== activeConcept.id) {
        lastSentConceptIdRef.current = activeConcept.id;
        const annotationsText = (activeConcept.representation.annotations || [])
          .map((a) => `${a.label}: ${a.detail}`)
          .join('; ');
        wsRef.current.send(
          JSON.stringify({
            type: 'contextUpdate',
            text: `O aluno selecionou o conceito "${activeConcept.title}" (${activeConcept.sourceReference}). Explicação: ${activeConcept.detailedExplanation}. No quadro está exibido o esquema "${activeConcept.representation.title}" (${activeConcept.representation.type}) com a pergunta "${activeConcept.representation.guidingQuestion}" e legendas: ${annotationsText}.`,
          })
        );
      }
    }
  }, [activeConcept, studyMaterial]);

  // Synchronize highlighted board element with active Live session
  useEffect(() => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      highlightedElement &&
      activeConcept
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: 'contextUpdate',
          text: `O aluno clicou/destacou o elemento "${highlightedElement}" no quadro do conceito "${activeConcept.title}".`,
        })
      );
    }
  }, [highlightedElement, activeConcept]);

  // When a new Nano Banana Pro infographic completes, send it as visual context to the Live tutor
  useEffect(() => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      activeInfographic &&
      lastSentInfographicIdRef.current !== activeInfographic.id
    ) {
      lastSentInfographicIdRef.current = activeInfographic.id;
      wsRef.current.send(
        JSON.stringify({
          type: 'visualContext',
          imageBase64: activeInfographic.imageUrl,
          mimeType: activeInfographic.mimeType,
          caption: `Infográfico gerado com ${activeInfographic.modelUsed} sobre "${activeInfographic.conceptTitle}". Título: "${activeInfographic.visualDirection.shortTitle}". Conclusão: "${activeInfographic.visualDirection.conclusion}". O aluno agora pode fazer perguntas sobre esta imagem.`,
        })
      );
    }
  }, [activeInfographic]);

  const playAudioChunk = useCallback((base64Data: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }

    const float32 = base64ToFloat32Array(base64Data);
    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.push(source);
    setLiveState('responding');

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setLiveState((prev) => (prev === 'responding' ? 'listening' : prev));
      }
    };
  }, []);

  const startLiveSession = async () => {
    setErrorMessage(null);
    setLiveState('connecting');

    // Cancel any browser speechSynthesis to guarantee two voices never overlap
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      // Request real microphone access from user gesture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const annotationsSummary = (activeConcept?.representation.annotations || [])
          .map((a) => `${a.label} (${a.detail})`)
          .join('; ');

        ws.send(
          JSON.stringify({
            type: 'init',
            context: {
              documentTitle: studyMaterial?.documentTitle || 'Sala de Aula',
              executiveSummary: studyMaterial?.executiveSummary || '',
              conceptTitle: activeConcept?.title || '',
              sourceReference: activeConcept?.sourceReference || '',
              conceptExplanation: activeConcept?.detailedExplanation || '',
              representationSummary: activeConcept
                ? `${activeConcept.representation.title} [${activeConcept.representation.type}] - Pergunta: ${activeConcept.representation.guidingQuestion}. Legendas: ${annotationsSummary}`
                : '',
              allConcepts: (studyMaterial?.concepts || []).map(
                (c) => `${c.id} ("${c.title}")`
              ),
            },
          })
        );

        lastSentConceptIdRef.current = activeConcept?.id || null;

        // Start microphone 16kHz PCM capture
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (isMutedRef.current) return;
          if (ws.readyState === WebSocket.OPEN) {
            const channelData = event.inputBuffer.getChannelData(0);
            const base64Audio = float32ToPcm16Base64(channelData);
            ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
          }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            if (msg.status === 'listening') {
              setLiveState('listening');
            } else if (msg.status === 'disconnected') {
              cleanupSession();
              setLiveState('disconnected');
            }
          } else if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            stopAllPlayback();
            setLiveState('listening');
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscript('student', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscript('tutor', msg.text);
          } else if (msg.type === 'toolCall') {
            const { id, name, args } = msg;
            let toolResult: Record<string, unknown> = { status: 'error' };

            if (name === 'selectConceptOnBoard') {
              const res = callbacksRef.current.onSelectConceptByIdOrTitle(
                String(args?.conceptIdOrTitle || '')
              );
              toolResult = res.success
                ? {
                    status: 'success',
                    message: `Quadro atualizado com sucesso para o conceito "${res.matchedTitle}".`,
                  }
                : {
                    status: 'not_found',
                    message: 'Conceito não encontrado na lista atual do documento.',
                  };
              if (res.success) {
                appendTranscript(
                  'system',
                  `Quadro atualizado pelo tutor: conceito "${res.matchedTitle}"`
                );
              }
            } else if (name === 'highlightBoardElement') {
              const res = callbacksRef.current.onHighlightElement(
                String(args?.elementIdOrLabel || '')
              );
              toolResult = {
                status: res.success ? 'success' : 'failed',
                highlightedElement: res.highlighted,
              };
              if (res.success) {
                appendTranscript(
                  'system',
                  `Elemento destacado no quadro: "${res.highlighted}"`
                );
              }
            } else if (name === 'updateBoardRepresentation') {
              const res = callbacksRef.current.onUpdateBoardFromLive({
                newGuidingQuestion: String(args?.newGuidingQuestion || ''),
                newTakeaway: String(args?.newTakeaway || ''),
                addedAnnotationLabel: args?.addedAnnotationLabel
                  ? String(args.addedAnnotationLabel)
                  : undefined,
                addedAnnotationDetail: args?.addedAnnotationDetail
                  ? String(args.addedAnnotationDetail)
                  : undefined,
                addedAnnotationColor: args?.addedAnnotationColor,
              });
              toolResult = {
                status: res.success ? 'success' : 'failed',
                message: 'Representação e anotações do quadro verde atualizadas.',
              };
              if (res.success) {
                appendTranscript('system', 'O tutor adicionou uma nova anotação ao quadro verde.');
              }
            } else if (name === 'generateInfographicWithNanoBananaPro') {
              appendTranscript(
                'system',
                'Gerando infográfico 16:9 com Nano Banana Pro (gemini-3-pro-image)...'
              );
              const res = await callbacksRef.current.onTriggerInfographicFromLive(
                String(args?.focusQuestion || '')
              );
              toolResult = res.success
                ? {
                    status: 'success',
                    message:
                      'Infográfico gerado com sucesso pelo gemini-3-pro-image e exibido ao aluno.',
                  }
                : {
                    status: 'failed',
                    error:
                      res.error ||
                      'Não foi possível gerar o infográfico com gemini-3-pro-image.',
                  };
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'toolResult',
                  id,
                  result: toolResult,
                })
              );
            }
          } else if (msg.type === 'error') {
            setErrorMessage(
              msg.userMessage || 'Erro na sessão de voz do Gemini Live.'
            );
            cleanupSession();
            setLiveState('error');
          }
        } catch (e) {
          console.error('Error processing Live message:', e);
        }
      };

      ws.onerror = () => {
        setErrorMessage('Falha na conexão WebSocket com o servidor Gemini Live.');
        cleanupSession();
        setLiveState('error');
      };
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Autorize o uso do microfone no navegador para conversar por voz com o tutor.'
          : err instanceof Error
          ? err.message
          : 'Não foi possível acessar o microfone.';
      setErrorMessage(msg);
      cleanupSession();
      setLiveState('error');
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
  };

  const endLiveSession = () => {
    cleanupSession();
    setLiveState('disconnected');
    setIsMuted(false);
    isMutedRef.current = false;
  };

  const statusLabelMap: Record<LiveConnectionState, string> = {
    disconnected: 'Desconectado',
    connecting: 'Conectando ao Gemini Live...',
    listening: isMuted ? 'Microfone silenciado' : 'Ouvindo você (conversa contínua)',
    responding: 'Tutor respondendo por voz...',
    error: 'Erro na conexão',
  };

  return (
    <div className="sticky top-0 z-30 bg-[#F9F6EE]/95 backdrop-blur-md border-b border-[#D8D2C2] px-4 sm:px-6 py-3 shadow-xs">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Classroom Identity & Current Status */}
        <div className="flex items-center gap-4">
          <span className="font-display text-xl sm:text-2xl font-bold text-[#163024] tracking-tight whitespace-nowrap">
            Minha sala de aula
          </span>
          <span className="text-[#9E9785]" aria-hidden="true">
            ·
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-[#2E382E]">
            <span>Estado do Tutor:</span>
            <span
              className={`font-semibold ${
                liveState === 'listening'
                  ? 'text-[#15803D]'
                  : liveState === 'responding'
                  ? 'text-[#0369A1]'
                  : liveState === 'error'
                  ? 'text-[#BE123C]'
                  : 'text-[#5C645C]'
              }`}
            >
              {statusLabelMap[liveState]}
            </span>
          </div>
        </div>

        {/* Right: Prominent Always-Accessible Live Voice Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {liveState === 'disconnected' || liveState === 'error' ? (
            <button
              type="button"
              onClick={startLiveSession}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#163024] hover:bg-[#1E4231] text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Mic className="w-4 h-4 text-[#FDE047]" />
              <span>
                {liveState === 'error' ? 'Tentar novamente (Tutor Live)' : 'Conversar com o tutor'}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isMuted
                    ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]'
                    : 'bg-white border-[#D8D2C2] text-[#1E241E] hover:bg-[#F3EFE4]'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#15803D]" />}
                <span>{isMuted ? 'Ativar microfone' : 'Silenciar microfone'}</span>
              </button>

              <button
                type="button"
                onClick={endLiveSession}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Encerrar sessão</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsTranscriptOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D8D2C2] bg-white hover:bg-[#F3EFE4] text-xs font-semibold text-[#2E382E] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Transcrição ({transcripts.length})</span>
            {isTranscriptOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div className="max-w-[1440px] mx-auto mt-2.5 p-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] flex items-center justify-between gap-3 text-sm text-[#9F1239]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={startLiveSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BE123C] text-white text-xs font-semibold hover:bg-[#9F1239] shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* Expandable Live Audio Transcript Drawer */}
      {isTranscriptOpen && (
        <div className="max-w-[1440px] mx-auto mt-3 p-4 rounded-xl bg-white border border-[#D8D2C2] max-h-56 overflow-y-auto space-y-2.5 text-sm">
          <div className="flex items-center justify-between text-xs text-[#6E6A5E] pb-1.5 border-b border-[#EFECE2]">
            <span>Transcrição em tempo real da sessão de voz (Gemini Live)</span>
            {transcripts.length > 0 && (
              <button
                type="button"
                onClick={() => setTranscripts([])}
                className="text-xs underline hover:text-[#1E241E] cursor-pointer"
              >
                Limpar transcrição
              </button>
            )}
          </div>
          {transcripts.length === 0 ? (
            <p className="text-[#6E6A5E] italic">
              Nenhuma fala registrada ainda. Clique em “Conversar com o tutor” e fale normalmente pelo microfone.
            </p>
          ) : (
            transcripts.map((entry) => (
              <div
                key={entry.id}
                className={`p-2.5 rounded-lg ${
                  entry.speaker === 'student'
                    ? 'bg-[#F3EFE4] text-[#1E241E]'
                    : entry.speaker === 'tutor'
                    ? 'bg-[#ECFDF5] text-[#064E3B]'
                    : 'bg-[#FEF9C3] text-[#713F12] font-mono text-xs'
                }`}
              >
                <span className="font-bold mr-2">
                  {entry.speaker === 'student'
                    ? 'Você:'
                    : entry.speaker === 'tutor'
                    ? 'Tutor Live:'
                    : 'Quadro:'}
                </span>
                <span>{entry.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
