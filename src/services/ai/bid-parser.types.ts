// Contract for the AI bid parser. The implementation lives in bid-parser.ts.

export interface ParserScopeLine {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
}

export interface ParsedBidLine {
  description: string;
  kind: 'INCLUSION' | 'EXCLUSION' | 'ALLOWANCE' | 'ALTERNATE';
  /** Matched scope line id, or null when the line maps to nothing in scope. */
  scopeLineItemId: string | null;
  quantity?: number;
  unit?: string;
  unitPriceCents?: number;
  totalCents: number;
  laborCents?: number;
  materialCents?: number;
  /** 0-1 parse confidence for this line. */
  confidence: number;
  /** Verbatim text span this line was extracted from — provenance. */
  sourceText: string;
}

export interface ParsedBid {
  lineItems: ParsedBidLine[];
  /** Model id used, or null when the deterministic fixture path ran. */
  model: string | null;
  parserVersion: string;
  overallConfidence: number;
  /** True when no ANTHROPIC_API_KEY was configured and the fixture parser ran. */
  usedFixture: boolean;
}
