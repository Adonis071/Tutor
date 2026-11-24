export type RepresentationType =
  | 'labeled_drawing'
  | 'comparison'
  | 'process'
  | 'chart'
  | 'relationship_map';

export interface BoardAnnotation {
  id: string;
  label: string;
  detail: string;
  color: 'white' | 'yellow' | 'blue' | 'coral';
}

export interface ComparisonSide {
  title: string;
  subtitle: string;
  points: string[];
  accentColor: 'yellow' | 'blue' | 'coral' | 'white';
}

export interface ProcessNode {
  id: string;
  stepLabel: string;
  title: string;
  description: string;
  color: 'yellow' | 'blue' | 'coral' | 'white';
}

export interface ChartDataPoint {
  label: string;
  value: number;
  unit: string;
  color: 'yellow' | 'blue' | 'coral' | 'white';
  note?: string;
}

export interface RelationshipNode {
  id: string;
  label: string;
  role: string;
  color: 'yellow' | 'blue' | 'coral' | 'white';
}

export interface RelationshipEdge {
  from: string;
  to: string;
  relationLabel: string;
}

export interface VisualRepresentation {
  type: RepresentationType;
  guidingQuestion: string;
  title: string;
  subtitle: string;
  /**
   * Optional clean SVG markup (viewBox="0 0 800 420") drawn in chalkboard palette
   * (#FFFFFF, #FDE047, #7DD3FC, #FB7185) with data-element-id attributes for highlighting.
   */
  svgCode?: string;
  /**
   * Domain-accurate preset key when matching verified physical/scientific schematics
   * (e.g. 'solar_eclipse', 'lunar_eclipse', 'orbital_inclination') or 'custom_svg'
   */
  diagramPreset?:
    | 'solar_eclipse'
    | 'lunar_eclipse'
    | 'orbital_inclination'
    | 'vascular_xylem_phloem'
    | 'bohr_oxygen_curve'
    | 'custom';
  annotations: BoardAnnotation[];
  comparison?: {
    left: ComparisonSide;
    right: ComparisonSide;
    keyDifference: string;
  };
  processSteps?: ProcessNode[];
  chartData?: {
    yAxisLabel: string;
    xAxisLabel: string;
    points: ChartDataPoint[];
  };
  relationships?: {
    nodes: RelationshipNode[];
    edges: RelationshipEdge[];
  };
  takeaway: string;
  scaleDisclaimer?: string;
}

export interface StudyConcept {
  id: string;
  title: string;
  sourceReference: string; // e.g. "Página 2" or "Seção: Umbra e Penumbra"
  shortSummary: string;
  detailedExplanation: string;
  openQuestionPrompt: string; // For "Agora eu explico"
  representation: VisualRepresentation;
}

export interface StudyMaterialAnalysis {
  documentTitle: string;
  sourceType: 'pdf' | 'notes' | 'sample';
  hasPageNumbers: boolean;
  executiveSummary: string;
  rawTextPreview: string;
  concepts: StudyConcept[];
}

export interface EvaluationResult {
  understoodCorrectly: string[];
  missingOrConfused: string[];
  specificCorrection: string;
  encouragementNote: string;
}

export interface VisualDirection {
  mainQuestion: string;
  shortTitle: string;
  mainIllustrationDescription: string;
  sections: { heading: string; caption: string }[];
  conclusion: string;
  scaleNote?: string;
}

export interface GeneratedInfographic {
  id: string;
  conceptId: string;
  conceptTitle: string;
  imageUrl: string;
  mimeType: string;
  modelUsed: string;
  aspectRatio: string;
  resolution: string;
  visualDirection: VisualDirection;
  visualReviewNotes?: string[];
  createdAt: string;
}

export interface TutorQATurn {
  id: string;
  role: 'student' | 'tutor';
  text: string;
  shortcutLabel?: string;
  boardUpdated?: boolean;
  timestamp: string;
}
