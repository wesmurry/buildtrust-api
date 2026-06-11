import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { ParsedBid, ParsedBidLine, ParserScopeLine } from './bid-parser.types.js';

const PARSER_VERSION = '1.0.0';
const MODEL = 'claude-sonnet-4-6';
const TOOL_NAME = 'record_parsed_bid';

const SYSTEM_PROMPT = `You parse residential subcontractor bid documents into structured line items leveled against a trade scope sheet.

Rules:
- Extract every priced line item, exclusion, allowance, and alternate present in the bid document. Never invent line items that are not in the document.
- Match each line to the provided scope sheet; set scopeLineItemId to the matching scope line id, or null when nothing in scope matches. Never use an id that is not on the scope sheet.
- Detect exclusions: phrases like "by others", "excluded", or "not included" mean the line is an EXCLUSION (totalCents 0 unless the document prices it).
- All money values are integer cents (e.g. $18,500 -> 1850000). Never use floating-point dollars.
- Do not emit the bid's grand total as a line item.
- sourceText must be copied verbatim from the document span the line was extracted from.
- confidence is a 0-1 score for how certain the parse and scope match are for that line.`;

// --- Fixture parser (deterministic, runs when no ANTHROPIC_API_KEY) ---

const PRICED_LINE = /(.+?)[:\-–]\s*\$?([\d,]+(?:\.\d{2})?)/;
const EXCLUSION_PATTERN = /by others|exclud|not included/i;
const TOTAL_LINE = /^total\b/i;

const STOPWORDS = new Set([
  'a', 'all', 'an', 'and', 'any', 'approx', 'are', 'as', 'at', 'be', 'by',
  'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'per', 'the', 'to', 'with',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function matchScopeLine(text: string, scopeLines: ParserScopeLine[]): string | null {
  const tokens = tokenize(text);
  let bestId: string | null = null;
  let bestScore = 0;
  for (const scope of scopeLines) {
    const score = jaccard(tokens, tokenize(scope.description));
    if (score > bestScore) {
      bestScore = score;
      bestId = scope.id;
    }
  }
  return bestScore >= 0.18 ? bestId : null;
}

function dollarsToCents(raw: string): number {
  return Math.round(parseFloat(raw.replace(/,/g, '')) * 100);
}

function meanConfidence(lines: ParsedBidLine[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
}

export function parseBidFixture(rawText: string, scopeLines: ParserScopeLine[]): ParsedBid {
  const lineItems: ParsedBidLine[] = [];
  let statedTotalCents: number | null = null;

  for (const raw of rawText.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const priced = line.match(PRICED_LINE);
    const description = priced ? priced[1].trim() : line;

    if (EXCLUSION_PATTERN.test(line)) {
      lineItems.push({
        description,
        kind: 'EXCLUSION',
        scopeLineItemId: matchScopeLine(description, scopeLines),
        totalCents: priced ? dollarsToCents(priced[2]) : 0,
        confidence: 0.6,
        sourceText: line,
      });
      continue;
    }

    if (!priced) continue;

    if (TOTAL_LINE.test(description)) {
      statedTotalCents = dollarsToCents(priced[2]);
      continue;
    }

    const scopeLineItemId = matchScopeLine(description, scopeLines);
    lineItems.push({
      description,
      kind: 'INCLUSION',
      scopeLineItemId,
      totalCents: dollarsToCents(priced[2]),
      confidence: scopeLineItemId ? 0.9 : 0.7,
      sourceText: line,
    });
  }

  let overallConfidence = meanConfidence(lineItems);
  if (statedTotalCents !== null && statedTotalCents > 0) {
    const inclusionSum = lineItems
      .filter((l) => l.kind === 'INCLUSION')
      .reduce((sum, l) => sum + l.totalCents, 0);
    if (Math.abs(inclusionSum - statedTotalCents) / statedTotalCents > 0.01) {
      overallConfidence = Math.min(overallConfidence, 0.5);
    }
  }

  return {
    lineItems,
    model: null,
    parserVersion: PARSER_VERSION,
    overallConfidence,
    usedFixture: true,
  };
}

// --- Claude parser (runs when ANTHROPIC_API_KEY is set) ---

function buildResultSchema(scopeIds: Set<string>) {
  return z.object({
    lineItems: z.array(
      z.object({
        description: z.string().min(1),
        kind: z.enum(['INCLUSION', 'EXCLUSION', 'ALLOWANCE', 'ALTERNATE']),
        scopeLineItemId: z
          .string()
          .nullable()
          .refine((id) => id === null || scopeIds.has(id), {
            message: 'scopeLineItemId must be one of the provided scope line ids or null',
          }),
        quantity: z.number().optional(),
        unit: z.string().optional(),
        totalCents: z.number().int(),
        laborCents: z.number().int().optional(),
        materialCents: z.number().int().optional(),
        confidence: z.number().min(0).max(1),
        sourceText: z.string().min(1),
      }),
    ),
  });
}

function buildTool(scopeLines: ParserScopeLine[]): Anthropic.Tool {
  const ids = scopeLines.map((s) => s.id);
  return {
    name: TOOL_NAME,
    description: 'Record the structured line items parsed from a subcontractor bid document.',
    input_schema: {
      type: 'object',
      properties: {
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Line item description' },
              kind: { type: 'string', enum: ['INCLUSION', 'EXCLUSION', 'ALLOWANCE', 'ALTERNATE'] },
              scopeLineItemId: {
                type: ['string', 'null'],
                description: `Matched scope line id or null. Must be one of: ${ids.join(', ') || '(none — always null)'}`,
              },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              totalCents: { type: 'integer', description: 'Line total in integer cents' },
              laborCents: { type: 'integer' },
              materialCents: { type: 'integer' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              sourceText: {
                type: 'string',
                description: 'Verbatim span from the bid document this line came from',
              },
            },
            required: ['description', 'kind', 'scopeLineItemId', 'totalCents', 'confidence', 'sourceText'],
            additionalProperties: false,
          },
        },
      },
      required: ['lineItems'],
      additionalProperties: false,
    },
  };
}

async function parseBidWithClaude(
  rawText: string,
  scopeLines: ParserScopeLine[],
  apiKey: string,
): Promise<ParsedBid> {
  const client = new Anthropic({ apiKey });
  const resultSchema = buildResultSchema(new Set(scopeLines.map((s) => s.id)));
  const tool = buildTool(scopeLines);

  const scopeSheet = scopeLines.length
    ? scopeLines.map((s) => `${s.id} | ${s.description} | ${s.quantity} ${s.unit} | ${s.category}`).join('\n')
    : '(no scope lines provided)';

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Scope sheet (id | description | quantity unit | category):\n${scopeSheet}\n\nBid document:\n${rawText}`,
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [tool],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    const parsed = toolUse ? resultSchema.safeParse(toolUse.input) : null;
    if (parsed?.success) {
      const lineItems: ParsedBidLine[] = parsed.data.lineItems;
      return {
        lineItems,
        model: MODEL,
        parserVersion: PARSER_VERSION,
        overallConfidence: meanConfidence(lineItems),
        usedFixture: false,
      };
    }

    if (attempt === 0) {
      messages.push({ role: 'assistant', content: response.content });
      if (toolUse && parsed) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              is_error: true,
              content: `Tool input failed validation: ${issues}. Call ${TOOL_NAME} again with corrected input.`,
            },
          ],
        });
      } else {
        messages.push({
          role: 'user',
          content: `The response did not include a ${TOOL_NAME} tool call. Call ${TOOL_NAME} now with the parsed line items.`,
        });
      }
    }
  }

  return parseBidFixture(rawText, scopeLines);
}

export async function parseBidDocument(
  rawText: string,
  scopeLines: ParserScopeLine[],
): Promise<ParsedBid> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return parseBidFixture(rawText, scopeLines);
  return parseBidWithClaude(rawText, scopeLines, apiKey);
}
