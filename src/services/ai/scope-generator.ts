import { env } from '../../config/env.js';

interface ScopeDocument {
  descriptionOfWork: string;
  inclusions: string[];
  exclusions: string[];
  materialSpecs: string[];
  qualityStandards: string[];
  timelineReqs: string;
}

export async function generateScope(
  tradeName: string,
  _projectData: Record<string, any>,
): Promise<ScopeDocument> {
  if (env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY is set — real AI scope generation would run here');
  }

  // Stub: return template scope
  return {
    descriptionOfWork: `Provide all labor, materials, equipment, and supervision necessary to complete the ${tradeName} scope of work for this residential construction project per the approved plans and specifications.`,
    inclusions: [
      `All ${tradeName.toLowerCase()} work as shown on approved construction documents`,
      'All required permits and inspections coordination',
      'Job site cleanup related to this trade',
      'Warranty per manufacturer specifications',
    ],
    exclusions: [
      'Work by other trades',
      'Structural modifications not shown on plans',
      'Owner-supplied materials (unless noted)',
      'Permit fees (paid by GC)',
    ],
    materialSpecs: [
      'All materials per plans and specifications',
      'Substitutions require written approval from GC and Owner',
    ],
    qualityStandards: [
      'All work per applicable building codes',
      'Industry standard workmanship',
      'Clean and professional installation',
    ],
    timelineReqs: `Timeline to be coordinated with GC master schedule. Estimated duration based on project scope.`,
  };
}
