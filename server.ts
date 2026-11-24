import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  GoogleGenAI,
  Type,
  Modality,
  FunctionDeclaration,
  LiveServerMessage,
} from '@google/genai';

const PORT = 3000;

function getGenAIClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY_MISSING: A chave da API Gemini não está configurada no ambiente. Configure sua chave no painel Settings > Secrets do AI Studio.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown, attemptedModel: string) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const upper = rawMessage.toUpperCase();

  if (
    upper.includes('GEMINI_API_KEY_MISSING') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return {
      status: 401,
      errorCategory: 'PERMISSIONS_OR_KEY',
      attemptedModel,
      userMessage:
        'Chave de API ausente ou inválida. Verifique a configuração em Settings > Secrets no AI Studio.',
      technicalDetails: rawMessage,
    };
  }

  if (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA') ||
    upper.includes('429')
  ) {
    return {
      status: 429,
      errorCategory: 'QUOTA_EXCEEDED',
      attemptedModel,
      userMessage: `Limite diário da camada gratuita atingido (Erro 429) para o modelo ${attemptedModel}. Para continuar sem limite diário de 20 requisições, selecione uma chave de API com faturamento ativo em Settings > Secrets ou aguarde a renovação da cota.`,
      technicalDetails: rawMessage,
    };
  }

  if (
    upper.includes('BILLING') ||
    upper.includes('PAID') ||
    upper.includes('FAILED_PRECONDITION') ||
    (upper.includes('PERMISSION_DENIED') && attemptedModel.includes('image'))
  ) {
    return {
      status: 403,
      errorCategory: 'BILLING_REQUIRED',
      attemptedModel,
      userMessage: `O modelo ${attemptedModel} requer uma chave de API vinculada a um projeto do Google Cloud com faturamento (Billing) ativo. Ative o faturamento ou selecione uma chave paga em Settings > Secrets.`,
      technicalDetails: rawMessage,
    };
  }

  if (upper.includes('PERMISSION_DENIED') || upper.includes('403')) {
    return {
      status: 403,
      errorCategory: 'PERMISSION_DENIED',
      attemptedModel,
      userMessage: `Permissão negada ao acessar o modelo ${attemptedModel}. Verifique se sua chave em Settings > Secrets possui acesso habilitado a este modelo.`,
      technicalDetails: rawMessage,
    };
  }

  if (
    upper.includes('NOT_FOUND') ||
    upper.includes('404') ||
    upper.includes('MODEL NOT FOUND') ||
    upper.includes('UNSUPPORTED')
  ) {
    return {
      status: 404,
      errorCategory: 'MODEL_UNAVAILABLE',
      attemptedModel,
      userMessage: `O modelo solicitado (${attemptedModel}) não está disponível nesta região ou versão da API no seu projeto atual.`,
      technicalDetails: rawMessage,
    };
  }

  if (
    upper.includes('503') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND')
  ) {
    return {
      status: 503,
      errorCategory: 'HIGH_DEMAND_UNAVAILABLE',
      attemptedModel,
      userMessage: `O serviço do modelo está com alta demanda temporária (503). Clique em "Tentar novamente" em alguns segundos.`,
      technicalDetails: rawMessage,
    };
  }

  return {
    status: 500,
    errorCategory: 'UPSTREAM_ERROR',
    attemptedModel,
    userMessage: `Não foi possível concluir a requisição com o modelo ${attemptedModel}. Você pode tentar novamente.`,
    technicalDetails: rawMessage,
  };
}

function extractCleanJson(rawText: string): any {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  }
  return JSON.parse(candidate);
}

async function generateJsonViaLiveFallback(promptText: string): Promise<string> {
  const ai = getGenAIClient('v1beta');
  return new Promise<string>((resolve, reject) => {
    let accumulatedTranscript = '';
    let settled = false;
    let sessionRef: any = null;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          sessionRef?.close();
        } catch {}
        reject(new Error('Live fallback timed out waiting for JSON response.'));
      }
    }, 25000);

    ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction:
            'Você é um motor de análise estruturada JSON em português do Brasil. Responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown nem texto adicional.',
        },
        callbacks: {
          onopen: () => {},
          onmessage: (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts ?? [];
            for (const p of parts) {
              if (p.text) {
                accumulatedTranscript += p.text;
              }
            }
            if (message.serverContent?.turnComplete && !settled) {
              settled = true;
              clearTimeout(timer);
              try {
                sessionRef?.close();
              } catch {}
              resolve(accumulatedTranscript);
            }
          },
          onerror: (err: unknown) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(err);
            }
          },
          onclose: () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              if (accumulatedTranscript.trim()) {
                resolve(accumulatedTranscript);
              } else {
                reject(new Error('Live fallback closed before returning JSON.'));
              }
            }
          },
        },
      })
      .then((session) => {
        sessionRef = session;
        session.sendRealtimeInput({
          text: promptText,
        });
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

async function generateTextContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    fallbackPromptForLive?: string;
  }
) {
  const candidateModels = [
    { model: 'gemini-3.1-flash-lite', thinkingLevel: 'MINIMAL', stripSchema: false },
    { model: 'gemini-4-hydrogen', thinkingLevel: 'LOW', stripSchema: false },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: undefined, stripSchema: true },
  ];
  let lastError: unknown = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const { model, thinkingLevel, stripSchema } = candidateModels[i];
    try {
      const nextConfig = { ...(params.config || {}) };
      if (stripSchema && nextConfig.responseSchema) {
        delete nextConfig.responseSchema;
      }
      if (thinkingLevel) {
        nextConfig.thinkingConfig = { thinkingLevel };
      }

      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: nextConfig,
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const msg = rawMsg.toUpperCase();
      const isTransientOrFallbackable =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('HIGH DEMAND') ||
        msg.includes('DEADLINE_EXCEEDED') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('QUOTA') ||
        msg.includes('400');
      if (!isTransientOrFallbackable) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  if (params.fallbackPromptForLive) {
    try {
      const liveText = await generateJsonViaLiveFallback(params.fallbackPromptForLive);
      return {
        response: { text: liveText },
        modelUsed: 'gemini-3.8-live',
      };
    } catch {
      // Throw original error if Live fallback also fails
    }
  }

  throw lastError;
}

const CONCEPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: 'Slug identificador único do conceito.' },
    title: { type: Type.STRING, description: 'Título claro e didático do conceito.' },
    sourceReference: {
      type: Type.STRING,
      description:
        'Referência fiel à página (ex: "Página 2") se o PDF/documento tiver páginas, ou à seção real do texto (ex: "Seção: Transporte no Xilema") se não houver numeração de página. Nunca invente número de página.',
    },
    shortSummary: {
      type: Type.STRING,
      description: 'Resumo conciso de 1 a 2 frases para o caderno de estudos.',
    },
    detailedExplanation: {
      type: Type.STRING,
      description: 'Explicação didática, precisa e fiel ao documento (3 a 5 frases).',
    },
    openQuestionPrompt: {
      type: Type.STRING,
      description:
        'Pergunta aberta instigante para o aluno explicar o conceito com as próprias palavras no modo "Agora eu explico".',
    },
    representation: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description:
            'Escolha a representação visual mais adequada à natureza do conceito: "labeled_drawing" (desenho esquemático com legendas), "comparison" (comparação lado a lado), "process" (fluxo ou mecanismo em etapas), "chart" (gráfico quantitativo/comparativo) ou "relationship_map" (esquema de relações).',
        },
        guidingQuestion: {
          type: Type.STRING,
          description: 'Pergunta específica que este esquema visual do quadro responde.',
        },
        title: {
          type: Type.STRING,
          description: 'Título específico do quadro visual (evite títulos genéricos).',
        },
        subtitle: {
          type: Type.STRING,
          description: 'Subtítulo explicativo conectando o desenho ao documento.',
        },
        diagramPreset: {
          type: Type.STRING,
          description:
            'Use "solar_eclipse" SOMENTE se o conceito for eclipse solar (Sol-Lua-Terra, umbra e penumbra). Use "lunar_eclipse" SOMENTE se for eclipse lunar (Sol-Terra-Lua). Use "orbital_inclination" SOMENTE se for inclinação orbital da Lua (~5° e nodos). Use "vascular_xylem_phloem" se for comparação estrutural Xilema vs Floema. Caso contrário, use "custom" e forneça svgCode detalhado.',
        },
        svgCode: {
          type: Type.STRING,
          description:
            'Código SVG completo e autossuficiente com viewBox="0 0 800 400", fundo transparente, usando traços e textos grandes legíveis nas cores de giz (#FFFFFF branco, #FDE047 amarelo, #7DD3FC azul-claro, #FB7185 coral). Verifique que posições, setas e legendas correspondam com rigor físico/científico à explicação. Inclua atributos data-element-id nos grupos principais.',
        },
        annotations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              detail: { type: Type.STRING },
              color: {
                type: Type.STRING,
                description: 'Uma entre: "white", "yellow", "blue", "coral".',
              },
            },
            required: ['id', 'label', 'detail', 'color'],
          },
        },
        comparison: {
          type: Type.OBJECT,
          properties: {
            left: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                points: { type: Type.ARRAY, items: { type: Type.STRING } },
                accentColor: { type: Type.STRING },
              },
              required: ['title', 'subtitle', 'points', 'accentColor'],
            },
            right: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                points: { type: Type.ARRAY, items: { type: Type.STRING } },
                accentColor: { type: Type.STRING },
              },
              required: ['title', 'subtitle', 'points', 'accentColor'],
            },
            keyDifference: { type: Type.STRING },
          },
        },
        processSteps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              stepLabel: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              color: { type: Type.STRING },
            },
            required: ['id', 'stepLabel', 'title', 'description', 'color'],
          },
        },
        chartData: {
          type: Type.OBJECT,
          properties: {
            yAxisLabel: { type: Type.STRING },
            xAxisLabel: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  color: { type: Type.STRING },
                  note: { type: Type.STRING },
                },
                required: ['label', 'value', 'unit', 'color'],
              },
            },
          },
        },
        relationships: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  role: { type: Type.STRING },
                  color: { type: Type.STRING },
                },
                required: ['id', 'label', 'role', 'color'],
              },
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.STRING },
                  to: { type: Type.STRING },
                  relationLabel: { type: Type.STRING },
                },
                required: ['from', 'to', 'relationLabel'],
              },
            },
          },
        },
        takeaway: {
          type: Type.STRING,
          description: 'Síntese principal que responde à guidingQuestion.',
        },
        scaleDisclaimer: {
          type: Type.STRING,
          description: 'Ex: "Representação fora de escala para clareza didática" quando aplicável.',
        },
      },
      required: [
        'type',
        'guidingQuestion',
        'title',
        'subtitle',
        'annotations',
        'takeaway',
      ],
    },
  },
  required: [
    'id',
    'title',
    'sourceReference',
    'shortSummary',
    'detailedExplanation',
    'openQuestionPrompt',
    'representation',
  ],
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '35mb' }));

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      res.status(err.status || 400).json({
        userMessage:
          err.type === 'entity.too.large'
            ? 'O documento enviado é muito grande. Tente enviar um PDF menor ou colar o texto das páginas.'
            : 'Erro ao processar os dados enviados ao servidor.',
        technicalDetails: err.message || String(err),
      });
      return;
    }
    next();
  });

  // 1. Analyze Document (PDF base64, extracted PDF pages + figure snapshots, or Pasted Notes)
  app.post('/api/analyze-document', async (req, res) => {
    const modelName = 'gemini-4-hydrogen';
    try {
      const { pdfBase64, pageSnapshots, fileName, rawText, sourceType } = req.body as {
        pdfBase64?: string;
        pageSnapshots?: { pageNumber: number; mimeType: string; data: string }[];
        fileName?: string;
        rawText?: string;
        sourceType?: 'pdf' | 'notes' | 'sample';
      };

      if (
        !pdfBase64 &&
        (!pageSnapshots || pageSnapshots.length === 0) &&
        (!rawText || !rawText.trim())
      ) {
        res.status(400).json({
          userMessage: 'Envie um arquivo PDF válido ou cole suas anotações de estudo antes de começar a aula.',
        });
        return;
      }

      const ai = getGenAIClient();

      const parts: any[] = [];
      if (pdfBase64) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        });
      }
      if (Array.isArray(pageSnapshots)) {
        for (const snap of pageSnapshots.slice(0, 6)) {
          if (snap?.data) {
            parts.push({
              inlineData: {
                mimeType: snap.mimeType || 'image/jpeg',
                data: snap.data,
              },
            });
          }
        }
      }
      if (rawText && rawText.trim()) {
        parts.push({
          text: `CONTEÚDO DO MATERIAL DE ESTUDO (${fileName || 'Anotações'}):\n\n${rawText.slice(0, 45000)}`,
        });
      }

      parts.push({
        text: `Analise profundamente este material de estudo real em português do Brasil (incluindo figuras, diagramas e tabelas quando presentes).
Identifique de 3 a 5 conceitos principais distintos do documento.
REGRAS OBRIGATÓRIAS DE PRECISÃO DIDÁTICA:
1. Referências de origem: Se for um PDF ou texto com marcação de páginas, indique a página real (ex: "Página 1", "Página 2"). Se forem anotações sem páginas, referencie a seção real (ex: "Seção: Mecanismo de Coesão-Tensão") sem jamais inventar numeração de páginas.
2. Diversidade e Adequação Visual no Quadro: Escolha a representação ('type') que melhor explica cada conceito:
   - Use 'labeled_drawing' para geometria espacial, anatomia, óptica ou arranjos físicos.
   - Use 'comparison' quando o conceito contrastar duas estruturas, fenômenos ou estados (preenchendo 'comparison' E um 'svgCode' visual comparativo).
   - Use 'process' para mecanismos causais ou etapas reais (preenchendo 'processSteps' E um 'svgCode' esquemático).
   - Use 'chart' quando houver grandezas, taxas, curvas ou dados comparáveis (preenchendo 'chartData').
   - Use 'relationship_map' para redes de conceitos interdependentes que NÃO são etapas sequenciais (preenchendo 'relationships').
3. Rigor Científico em Eclipses (se o documento tratar de eclipses):
   - Eclipse solar: Ordem obrigatória Sol -> Lua -> Terra (Lua entre o Sol e a Terra), sombras (umbra central escura e penumbra externa parcial) projetadas atrás da Lua em direção à Terra, no sentido oposto ao Sol. Use diagramPreset="solar_eclipse".
   - Eclipse lunar: Ordem obrigatória Sol -> Terra -> Lua (Terra entre o Sol e a Lua), sombras projetadas atrás da Terra cobrindo a Lua. Use diagramPreset="lunar_eclipse".
   - Inclinação orbital: Plano da órbita lunar inclinado (~5,14°) em relação ao plano da eclíptica, mostrando os nodos orbitais e por que não há eclipse todo mês. Use diagramPreset="orbital_inclination".
4. Em todos os conceitos, gere também um 'svgCode' limpo, legível e fiel (viewBox="0 0 800 400") com paleta de giz sobre quadro verde escuro (#FFFFFF branco, #FDE047 amarelo, #7DD3FC azul-claro, #FB7185 coral), com textos ≥ 15px, setas precisas e legendas nunca cortadas.`,
      });

      const fallbackPromptForLive = `Analise o seguinte documento de estudo (${fileName || 'Material'}) e retorne EXCLUSIVAMENTE um objeto JSON válido com a estrutura exata:
{"documentTitle": "...", "hasPageNumbers": true, "executiveSummary": "...", "extractedTextPreview": "...", "concepts": [{"id": "c1", "title": "...", "sourceReference": "Página 1 ou Seção...", "shortSummary": "...", "detailedExplanation": "...", "openQuestionPrompt": "...", "representation": {"type": "labeled_drawing", "guidingQuestion": "...", "title": "...", "subtitle": "...", "diagramPreset": "solar_eclipse | lunar_eclipse | orbital_inclination | custom", "svgCode": "<svg viewBox=\\"0 0 800 400\\">...</svg>", "annotations": [{"id": "a1", "label": "...", "detail": "...", "color": "yellow"}], "takeaway": "..."}}]}

REGRAS:
- Se tratar de eclipses, use diagramPreset="solar_eclipse" para eclipse solar (Sol-Lua-Terra), "lunar_eclipse" para eclipse lunar (Sol-Terra-Lua) e "orbital_inclination" para inclinação orbital de 5,14°.
- Para outros temas, escolha type entre "labeled_drawing", "comparison", "process", "chart" ou "relationship_map" e gere svgCode válido.

DOCUMENTO:
${(rawText || 'Documento PDF enviado').slice(0, 12000)}`;

      const { response } = await generateTextContentWithRetry(ai, {
        contents: { parts },
        fallbackPromptForLive,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentTitle: { type: Type.STRING },
              hasPageNumbers: { type: Type.BOOLEAN },
              executiveSummary: { type: Type.STRING },
              extractedTextPreview: {
                type: Type.STRING,
                description:
                  'Transcrição ou trecho fiel das anotações/páginas originais do documento analisado para consulta no botão "Ver anotações originais".',
              },
              concepts: {
                type: Type.ARRAY,
                items: CONCEPT_SCHEMA,
              },
            },
            required: [
              'documentTitle',
              'hasPageNumbers',
              'executiveSummary',
              'extractedTextPreview',
              'concepts',
            ],
          },
        },
      });

      const parsed = extractCleanJson(response.text ?? '{}');
      if (!parsed.concepts || !Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
        throw new Error('O documento não produziu conceitos estruturados válidos.');
      }

      res.json({
        documentTitle: parsed.documentTitle || fileName || 'Material de Estudo',
        sourceType: sourceType || (pdfBase64 ? 'pdf' : 'notes'),
        hasPageNumbers: Boolean(parsed.hasPageNumbers),
        executiveSummary: parsed.executiveSummary,
        rawTextPreview: rawText?.trim() || parsed.extractedTextPreview || '',
        concepts: parsed.concepts,
      });
    } catch (err) {
      const classified = classifyGeminiError(err, modelName);
      res.status(classified.status).json(classified);
    }
  });

  // 2. Ask Question / Pedagogical Shortcuts below the Chalkboard
  app.post('/api/board-question', async (req, res) => {
    const modelName = 'gemini-4-hydrogen';
    try {
      const {
        documentTitle,
        executiveSummary,
        rawTextPreview,
        concept,
        question,
        shortcutType,
        conversationHistory,
        activeInfographic,
      } = req.body;

      const ai = getGenAIClient();

      const parts: any[] = [];

      if (activeInfographic?.imageUrl && activeInfographic.imageUrl.startsWith('data:')) {
        const matches = activeInfographic.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          });
        }
      }

      const historyText = Array.isArray(conversationHistory)
        ? conversationHistory
            .slice(-6)
            .map((t: any) => `${t.role === 'student' ? 'Aluno' : 'Tutor'}: ${t.text}`)
            .join('\n')
        : '';

      parts.push({
        text: `Você é o tutor da "Minha sala de aula" em português do Brasil.
MATERIAL ATUAL: "${documentTitle}"
RESUMO DO MATERIAL: ${executiveSummary}
TRECHO ORIGINAL DO DOCUMENTO:
${(rawTextPreview || '').slice(0, 6000)}

CONCEITO SELECIONADO NO QUADRO:
- Título: ${concept?.title} (${concept?.sourceReference})
- Explicação atual: ${concept?.detailedExplanation}
- Tipo de representação atual no quadro: ${concept?.representation?.type}
- Pergunta norteadora do quadro: ${concept?.representation?.guidingQuestion}
- Anotações visuais atuais: ${JSON.stringify(concept?.representation?.annotations || [])}

HISTÓRICO RECENTE DE PERGUNTAS:
${historyText || '(Início da conversa sobre este conceito)'}

AÇÃO / PERGUNTA DO ALUNO (${shortcutType || 'Pergunta livre'}):
"${question}"

INSTRUÇÕES:
1. Responda de maneira direta, acolhedora, didática e específica ao conceito atual (${concept?.title}) e ao documento.
2. Se a pergunta ou atalho ("Não entendi esta parte", "Explique de outra maneira", "Dê um exemplo do dia a dia", "O que acontece se mudarmos isso?") se beneficiar de uma atualização visual no quadro (por exemplo, mostrar uma analogia, destacar uma causa/efeito se mudarmos uma variável, ou reformular o esquema para ficar mais claro), defina "shouldUpdateBoard": true e forneça o objeto "updatedRepresentation" completo e coerente.
3. Se quiser destacar um elemento específico das anotações do quadro, informe o ID dele em "highlightElementId".`,
      });

      const fallbackPromptForLive = `Você é o tutor da "Minha sala de aula".
CONCEITO ATUAL: "${concept?.title}" (${concept?.sourceReference}) - ${concept?.detailedExplanation}
PERGUNTA DO ALUNO (${shortcutType || 'Dúvida'}): "${question}"
Retorne EXCLUSIVAMENTE um objeto JSON válido com esta estrutura:
{"tutorAnswer": "Resposta didática e clara em português do Brasil.", "shouldUpdateBoard": false, "highlightElementId": ""}`;

      const { response } = await generateTextContentWithRetry(ai, {
        contents: { parts },
        fallbackPromptForLive,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tutorAnswer: {
                type: Type.STRING,
                description: 'Resposta didática e clara em português do Brasil.',
              },
              shouldUpdateBoard: {
                type: Type.BOOLEAN,
                description:
                  'True se atualizar o quadro visual ajuda diretamente o aluno a visualizar a resposta.',
              },
              highlightElementId: {
                type: Type.STRING,
                description: 'ID opcional de uma anotação ou elemento do quadro para destacar.',
              },
              updatedRepresentation: CONCEPT_SCHEMA.properties.representation,
            },
            required: ['tutorAnswer', 'shouldUpdateBoard'],
          },
        },
      });

      const result = extractCleanJson(response.text ?? '{}');
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err, modelName);
      res.status(classified.status).json(classified);
    }
  });

  // 3. "Agora eu explico" — Evaluate student's own explanation
  app.post('/api/evaluate-explanation', async (req, res) => {
    const modelName = 'gemini-4-hydrogen';
    try {
      const { documentTitle, rawTextPreview, concept, studentExplanation } = req.body;

      if (!studentExplanation || !studentExplanation.trim()) {
        res.status(400).json({
          userMessage: 'Escreva ou grave sua explicação antes de solicitar a avaliação.',
        });
        return;
      }

      const ai = getGenAIClient();

      const evalPrompt = `Você é um professor criterioso e justo avaliando a atividade "Agora eu explico" em português do Brasil.
DOCUMENTO DE ESTUDO: "${documentTitle}"
TRECHO DE REFERÊNCIA DO DOCUMENTO:
${(rawTextPreview || '').slice(0, 5000)}

CONCEITO AVALIADO: "${concept?.title}" (${concept?.sourceReference})
RESUMO ESPERADO DO CONCEITO: ${concept?.detailedExplanation}
PERGUNTA FEITA AO ALUNO: "${concept?.openQuestionPrompt}"

EXPLICAÇÃO DADA PELO ALUNO:
"""
${studentExplanation}
"""

REGRAS DE AVALIAÇÃO:
1. Avalie o significado conceitual em relação ao material de estudo, sem exigir palavras exatas ou decoradas.
2. NÃO elogie automaticamente se a resposta estiver vazia, vaga, incorreta ou apenas repetir o título.
3. NÃO invente erros se o aluno explicou corretamente a essência do fenômeno com palavras simples.
4. Retorne EXCLUSIVAMENTE um objeto JSON com:
   - "understoodCorrectly": lista de strings com o que o aluno entendeu corretamente.
   - "missingOrConfused": lista de strings com o que faltou ou foi confundido.
   - "specificCorrection": correção breve e direta.
   - "encouragementNote": orientação objetiva sobre o que revisar no quadro.`;

      const { response } = await generateTextContentWithRetry(ai, {
        contents: evalPrompt,
        fallbackPromptForLive: evalPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              understoodCorrectly: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missingOrConfused: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              specificCorrection: { type: Type.STRING },
              encouragementNote: { type: Type.STRING },
            },
            required: [
              'understoodCorrectly',
              'missingOrConfused',
              'specificCorrection',
              'encouragementNote',
            ],
          },
        },
      });

      const evaluation = extractCleanJson(response.text ?? '{}');
      res.json(evaluation);
    } catch (err) {
      const classified = classifyGeminiError(err, modelName);
      res.status(classified.status).json(classified);
    }
  });

  // 4. Transcribe recorded audio snippet for "Agora eu explico"
  app.post('/api/transcribe-audio', async (req, res) => {
    const modelName = 'gemini-3.5-transcribe';
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        res.status(400).json({ userMessage: 'Áudio não recebido para transcrição.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcreva fielmente em português do Brasil a explicação falada pelo estudante, sem adicionar comentários extras.',
            },
          ],
        },
      });

      res.json({ transcript: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err, modelName);
      res.status(classified.status).json(classified);
    }
  });

  // 5. Generate or Edit Infographic with Nano Banana Pro (gemini-3-pro-image)
  app.post('/api/infographic/generate', async (req, res) => {
    const imageModelName = 'gemini-3-pro-image';
    try {
      const {
        documentTitle,
        rawTextPreview,
        concept,
        studentDoubtOrFocus,
        existingImageBase64,
        existingImageMimeType,
        correctionInstruction,
        existingVisualDirection,
      } = req.body;

      const ai = getGenAIClient();

      // Step A: Prepare editorial Visual Direction based on the concept & student doubt
      let visualDirection = existingVisualDirection;
      const isSolarEclipseConcept =
        /eclipse\s+solar|umbra\s+e\s+penumbra/i.test(concept?.title || '') ||
        concept?.representation?.diagramPreset === 'solar_eclipse';

      if (!existingImageBase64 || !visualDirection) {
        if (isSolarEclipseConcept) {
          visualDirection = {
            mainQuestion:
              'Por que duas pessoas na Terra veem o mesmo eclipse solar de formas diferentes?',
            shortTitle: 'O mesmo eclipse, duas formas de vê-lo',
            mainIllustrationDescription:
              'Esquema astronômico horizontal mostrando a ordem exata Sol à esquerda, Lua no centro e Terra à direita. Os cones de sombra se estendem atrás da Lua em direção à Terra: a Umbra escura central e a Penumbra mais clara ao redor. Na superfície da Terra há dois observadores marcados (Observador A na Umbra e Observador B na Penumbra) conectados a duas grandes janelas circulares de visualização mostrando o que cada um enxerga no céu: Eclipse Total (coroa solar ao redor da Lua escura) e Eclipse Parcial (Sol parcialmente coberto).',
            sections: [
              {
                heading: 'Alinhamento Sol – Lua – Terra',
                caption: 'Sombras projetadas atrás da Lua em direção à Terra (Fora de escala).',
              },
              {
                heading: 'Observador na Umbra: Eclipse Total',
                caption: 'A Lua bloqueia 100% do disco solar direto.',
              },
              {
                heading: 'Observador na Penumbra: Eclipse Parcial',
                caption: 'Apenas parte do Sol é ocultada pela Lua.',
              },
            ],
            conclusion: 'O que você vê depende de onde está.',
            scaleNote: 'Fora de escala',
          };
        } else {
          const dirResp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Prepare uma direção visual editorial concisa para um infográfico didático horizontal (16:9) em português do Brasil.
MATERIAL: "${documentTitle}"
CONCEITO: "${concept?.title}" (${concept?.sourceReference})
EXPLICAÇÃO DO DOCUMENTO: ${concept?.detailedExplanation}
FOCO OU DÚVIDA DO ALUNO: ${studentDoubtOrFocus || concept?.representation?.guidingQuestion || 'Compreender a estrutura visual e relações principais deste conceito.'}
TRECHO DO DOCUMENTO: ${(rawTextPreview || '').slice(0, 3000)}

REGRAS DE DIREÇÃO VISUAL:
- Uma pergunta principal clara ("mainQuestion").
- Um título breve e impactante ("shortTitle", máximo 8 palavras).
- Uma ilustração principal grande e bem definida ("mainIllustrationDescription") que explique o fenômeno com rigor científico, sem copiar cartões da interface.
- No máximo 2 ou 3 seções ("sections") com legendas curtas e legíveis em português do Brasil.
- Uma conclusão simples e memorável ("conclusion").`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  mainQuestion: { type: Type.STRING },
                  shortTitle: { type: Type.STRING },
                  mainIllustrationDescription: { type: Type.STRING },
                  sections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        heading: { type: Type.STRING },
                        caption: { type: Type.STRING },
                      },
                      required: ['heading', 'caption'],
                    },
                  },
                  conclusion: { type: Type.STRING },
                  scaleNote: { type: Type.STRING },
                },
                required: [
                  'mainQuestion',
                  'shortTitle',
                  'mainIllustrationDescription',
                  'sections',
                  'conclusion',
                ],
              },
            },
          });
          visualDirection = JSON.parse((dirResp.text ?? '{}').trim());
        }
      }

      // Step B: Call real Nano Banana Pro (gemini-3-pro-image) with 16:9 and 2K resolution
      const imageParts: any[] = [];
      if (existingImageBase64 && correctionInstruction) {
        const cleanBase64 = existingImageBase64.replace(/^data:[^;]+;base64,/, '');
        imageParts.push({
          inlineData: {
            mimeType: existingImageMimeType || 'image/png',
            data: cleanBase64,
          },
        });
        imageParts.push({
          text: `Edite este infográfico educacional em português do Brasil aplicando exclusivamente a seguinte correção solicitada pelo estudante, preservando toda a composição, o rigor científico e os demais elementos que não foram solicitados alterar:
CORREÇÃO SOLICITADA: "${correctionInstruction}"
Certifique-se de manter a ortografia impecável em português do Brasil, legendas grandes e legíveis, título "${visualDirection.shortTitle}" e conclusão "${visualDirection.conclusion}".`,
        });
      } else {
        const sectionsPrompt = (visualDirection.sections || [])
          .slice(0, 3)
          .map((s: any, idx: number) => `${idx + 1}. "${s.heading}" — ${s.caption}`)
          .join('\n');

        imageParts.push({
          text: `Crie um infográfico científico editorial de alta qualidade didática em formato horizontal 16:9, com textos curtos, nítidos e legíveis em PORTUGUÊS DO BRASIL.
Não desenhe capturas de tela nem cartões de interface web. Crie uma prancha ilustrada estilo revista científica moderna com paleta consistente (fundo creme marfim suave ou azul-petróleo escuro profundo, destaques em amarelo-ouro, azul-claro e coral).

DIREÇÃO VISUAL OBRIGATÓRIA:
- Pergunta norteadora no topo: "${visualDirection.mainQuestion}"
- Título principal em destaque: "${visualDirection.shortTitle}"
- Ilustração central grande e dominante: ${visualDirection.mainIllustrationDescription}
- Seções e legendas (máximo 3 blocos integrados à ilustração com setas precisas):
${sectionsPrompt}
- Conclusão na base: "${visualDirection.conclusion}"
${visualDirection.scaleNote ? `- Nota discreta: "${visualDirection.scaleNote}"` : ''}

Use poucas palavras, tipografia grande de fácil leitura e precisão científica absoluta nas posições e setas.`,
        });
      }

      const imageResponse = await ai.models.generateContent({
        model: imageModelName,
        contents: { parts: imageParts },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K',
          },
        },
      });

      let generatedBase64: string | null = null;
      let generatedMime = 'image/png';

      for (const part of imageResponse.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          generatedBase64 = part.inlineData.data;
          generatedMime = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!generatedBase64) {
        throw new Error(
          'O modelo gemini-3-pro-image concluiu a chamada mas não retornou bytes de imagem na resposta.'
        );
      }

      // Step C: Optional visual review for guidance (never as guarantee of precision)
      let visualReviewNotes: string[] = [];
      try {
        const reviewResp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: generatedMime,
                  data: generatedBase64,
                },
              },
              {
                text: `Compare este infográfico gerado com o conceito "${concept?.title}" (${concept?.detailedExplanation}).
Forneça 2 ou 3 observações curtas de orientação para o estudante (verificando legendas em português, posições relativas e coerência científica, lembrando que a revisão visual é uma orientação de estudo e não uma garantia absoluta).`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                notes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['notes'],
            },
          },
        });
        const parsedReview = JSON.parse((reviewResp.text ?? '{}').trim());
        if (Array.isArray(parsedReview.notes)) {
          visualReviewNotes = parsedReview.notes;
        }
      } catch {
        visualReviewNotes = [
          'Confira nas legendas da imagem se a ordem dos elementos e o sentido das setas correspondem ao esquema do quadro.',
        ];
      }

      res.json({
        imageUrl: `data:${generatedMime};base64,${generatedBase64}`,
        mimeType: generatedMime,
        modelUsed: imageModelName,
        aspectRatio: '16:9',
        resolution: '2K',
        visualDirection,
        visualReviewNotes,
      });
    } catch (err) {
      const classified = classifyGeminiError(err, imageModelName);
      res.status(classified.status).json(classified);
    }
  });

  // 6. Real-Time Gemini Live WebSocket Bridge (/live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const liveTools: FunctionDeclaration[] = [
    {
      name: 'selectConceptOnBoard',
      description:
        'Troca o conceito atualmente exibido no quadro didático para outro conceito do documento quando o aluno pede para avançar, voltar ou mudar de tópico.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          conceptIdOrTitle: {
            type: Type.STRING,
            description: 'ID ou título do conceito para exibir no quadro.',
          },
        },
        required: ['conceptIdOrTitle'],
      },
    },
    {
      name: 'highlightBoardElement',
      description:
        'Destaca visualmente uma legenda, região ou componente específico no quadro verde enquanto você explica por voz.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          elementIdOrLabel: {
            type: Type.STRING,
            description:
              'ID ou texto da legenda/elemento no quadro atual (ex: "umbra", "penumbra", "lua", "xilema", "floema").',
          },
        },
        required: ['elementIdOrLabel'],
      },
    },
    {
      name: 'updateBoardRepresentation',
      description:
        'Atualiza a pergunta norteadora, a síntese ou adiciona uma nova anotação explicativa ao quadro verde atual para responder visualmente a uma dúvida ou hipótese do aluno.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          newGuidingQuestion: {
            type: Type.STRING,
            description: 'Nova pergunta norteadora no topo do quadro.',
          },
          newTakeaway: {
            type: Type.STRING,
            description: 'Nova síntese ou conclusão na base do quadro.',
          },
          addedAnnotationLabel: {
            type: Type.STRING,
            description: 'Título curto de uma nova legenda/nota adicionada ao quadro.',
          },
          addedAnnotationDetail: {
            type: Type.STRING,
            description: 'Explicação curta da nova nota adicionada ao quadro.',
          },
          addedAnnotationColor: {
            type: Type.STRING,
            description: 'Cor do giz no quadro: "yellow", "blue", "coral" ou "white".',
          },
        },
        required: ['newGuidingQuestion', 'newTakeaway'],
      },
    },
    {
      name: 'generateInfographicWithNanoBananaPro',
      description:
        'Aciona a geração real de um infográfico ilustrado em 16:9 (2K) com o modelo Nano Banana Pro (gemini-3-pro-image) sobre o conceito atual quando o aluno pedir por voz para criar ou gerar um infográfico.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          focusQuestion: {
            type: Type.STRING,
            description: 'Dúvida ou foco principal solicitado pelo aluno para o infográfico.',
          },
        },
        required: ['focusQuestion'],
      },
    },
  ];

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSessionPromise: Promise<any> | null = null;
    let isClosed = false;
    const pendingToolCallbacks = new Map<
      string,
      (clientResult: Record<string, unknown>) => void
    >();

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'init') {
          const liveModel = 'gemini-3.8-live';
          try {
            const ai = getGenAIClient('v1beta');
            const initialContext = msg.context || {};

            const systemInstruction = `Você é o tutor de voz em tempo real da "Minha sala de aula", falando sempre em português do Brasil com tom acolhedor, claro, breve e didático.
REGRAS FUNDAMENTAIS:
1. Você NÃO vê a tela automaticamente; baseie-se sempre no contexto do documento, no conceito atual e na representação do quadro que o sistema envia a você.
2. Mantenha suas respostas faladas concisas (2 a 4 frases por turno) para permitir diálogo natural e perguntas de acompanhamento do estudante.
3. Você possui ferramentas reais conectadas ao quadro verde da sala de aula:
   - Use "highlightBoardElement" para destacar uma região ou legenda existente no desenho do quadro enquanto explica.
   - Use "updateBoardRepresentation" quando quiser anotar uma conclusão, analogia ou hipótese ("E se mudarmos isso?") no quadro.
   - Use "selectConceptOnBoard" se o aluno pedir para mudar para outro conceito do caderno.
   - Use "generateInfographicWithNanoBananaPro" se o aluno pedir por voz para criar ou gerar um infográfico.
4. NUNCA anuncie que alterou um desenho, trocou de conceito ou gerou um infográfico antes de receber a confirmação real da ferramenta correspondente. Se uma ferramenta retornar erro, explique o erro com transparência.

CONTEXTO INICIAL DA AULA:
Documento: ${initialContext.documentTitle || 'Material de estudo'}
Resumo: ${initialContext.executiveSummary || ''}
Conceito Atual no Quadro: ${initialContext.conceptTitle || ''} (${initialContext.sourceReference || ''})
Explicação do Conceito: ${initialContext.conceptExplanation || ''}
Representação no Quadro: ${initialContext.representationSummary || ''}
Lista de Conceitos Disponíveis: ${(initialContext.allConcepts || []).join(', ')}`;

            liveSessionPromise = ai.live.connect({
              model: liveModel,
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                  },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: [{ functionDeclarations: liveTools }],
                systemInstruction,
              },
              callbacks: {
                onopen: () => {
                  sendToClient({
                    type: 'status',
                    status: 'listening',
                    modelUsed: liveModel,
                  });
                },
                onmessage: (message: LiveServerMessage) => {
                  const content = message.serverContent;

                  if (content?.inputTranscription?.text) {
                    sendToClient({
                      type: 'inputTranscript',
                      text: content.inputTranscription.text,
                    });
                  }

                  if (content?.outputTranscription?.text) {
                    sendToClient({
                      type: 'outputTranscript',
                      text: content.outputTranscription.text,
                    });
                  }

                  for (const part of content?.modelTurn?.parts ?? []) {
                    if (part.inlineData?.data) {
                      sendToClient({
                        type: 'audio',
                        audio: part.inlineData.data,
                      });
                    }
                  }

                  if (content?.interrupted) {
                    sendToClient({ type: 'interrupted' });
                  }

                  if (content?.turnComplete) {
                    sendToClient({ type: 'turnComplete' });
                  }

                  // Handle tool calls and wait for real frontend UI confirmation before responding to the model
                  for (const call of message.toolCall?.functionCalls ?? []) {
                    const callId = call.id || `call_${Date.now()}`;
                    const callName = call.name || '';
                    const callArgs = call.args || {};

                    pendingToolCallbacks.set(callId, (clientResult) => {
                      liveSessionPromise
                        ?.then((session) => {
                          session.sendToolResponse({
                            functionResponses: [
                              {
                                id: callId,
                                name: callName,
                                response: clientResult,
                              },
                            ],
                          });
                        })
                        .catch((err) => {
                          console.error('Error sending tool response to Live session:', err);
                        });
                    });

                    sendToClient({
                      type: 'toolCall',
                      id: callId,
                      name: callName,
                      args: callArgs,
                    });
                  }
                },
                onerror: (err: unknown) => {
                  const classified = classifyGeminiError(err, liveModel);
                  sendToClient({
                    type: 'error',
                    userMessage: classified.userMessage,
                    technicalDetails: classified.technicalDetails,
                  });
                },
                onclose: () => {
                  if (!isClosed) {
                    sendToClient({ type: 'status', status: 'disconnected' });
                  }
                },
              },
            });

            await liveSessionPromise;
          } catch (err) {
            const classified = classifyGeminiError(err, liveModel);
            sendToClient({
              type: 'error',
              userMessage: classified.userMessage,
              technicalDetails: classified.technicalDetails,
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.audio && liveSessionPromise) {
          const session = await liveSessionPromise;
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
          return;
        }

        if (msg.type === 'contextUpdate' && liveSessionPromise) {
          const session = await liveSessionPromise;
          session.sendRealtimeInput({
            text: `[ATUALIZAÇÃO DE CONTEXTO DA SALA DE AULA]: ${msg.text}`,
          });
          return;
        }

        if (msg.type === 'visualContext' && msg.imageBase64 && liveSessionPromise) {
          const session = await liveSessionPromise;
          const cleanBase64 = msg.imageBase64.replace(/^data:[^;]+;base64,/, '');
          session.sendRealtimeInput({
            video: {
              data: cleanBase64,
              mimeType: msg.mimeType || 'image/png',
            },
          });
          if (msg.caption) {
            session.sendRealtimeInput({
              text: `[CONTEXTO VISUAL ENVIADO AO TUTOR]: ${msg.caption}`,
            });
          }
          return;
        }

        if (msg.type === 'toolResult' && msg.id) {
          const resolver = pendingToolCallbacks.get(msg.id);
          if (resolver) {
            pendingToolCallbacks.delete(msg.id);
            resolver(msg.result || { status: 'completed' });
          }
          return;
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      pendingToolCallbacks.clear();
      if (liveSessionPromise) {
        liveSessionPromise
          .then((session) => session.close())
          .catch(() => {});
      }
    });
  });

  // Vite middleware for development or static serving for production
  const distPath = path.resolve(process.cwd(), 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Minha sala de aula server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
