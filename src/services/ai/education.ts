// Pre-seeded education content for homeowners
// In production, missing topics would be generated via Claude API and cached

const EDUCATION_CONTENT: Record<string, string> = {
  'framing': 'Framing is the structural skeleton of your home. The framing crew builds the walls, floors, and roof structure using lumber or engineered wood. Think of it like the bones of your house — everything else gets attached to it.',
  'foundation': 'Your foundation is what your entire home sits on. It transfers the weight of the building to the ground. Most homes use either a concrete slab, a crawl space, or a full basement depending on your region and soil conditions.',
  'roofing': 'Roofing protects your home from weather. It includes the structural decking, waterproof underlayment, and the visible roofing material (shingles, metal panels, tile, etc.). A good roof should last 25-50 years depending on the material.',
  'hvac': 'HVAC stands for Heating, Ventilation, and Air Conditioning. It\'s the system that keeps your home comfortable year-round. The "rough-in" phase installs the ductwork and refrigerant lines inside the walls before drywall goes up.',
  'plumbing': 'Plumbing has two phases: rough-in and finish. Rough-in installs all the pipes inside your walls and floors before drywall. Finish is when the visible fixtures (faucets, toilets, sinks) get installed near the end of the project.',
  'electrical': 'Like plumbing, electrical has rough-in and finish phases. Rough-in runs all the wiring through walls and ceilings. Finish installs outlets, switches, light fixtures, and your electrical panel.',
  'drywall': 'Drywall (also called sheetrock) is what creates your interior walls and ceilings. Large sheets are screwed to the framing, then the joints are taped and covered with compound to create smooth, seamless surfaces ready for paint.',
  'insulation': 'Insulation keeps your home warm in winter and cool in summer. It goes in the walls, attic, and sometimes floors. Better insulation means lower energy bills. Common types include fiberglass batts, blown-in cellulose, and spray foam.',
  'three-bids': 'Getting at least three bids for each trade ensures you\'re paying a fair market price. It\'s not just about finding the cheapest option — comparing bids helps you understand what the work should cost and spot anything unusual.',
  'change-order': 'A change order is a formal modification to the original scope of work. It documents what changed, why, how much it costs, and how it affects the schedule. Always get change orders in writing before the work happens.',
  'cost-plus': 'Cost-plus pricing means you pay the actual cost of labor and materials, plus a percentage fee for your general contractor. It\'s transparent — you see every dollar spent — but the total isn\'t fixed upfront like a lump-sum contract.',
  'markup-vs-margin': 'Markup is a percentage added on top of cost. If something costs $100 and the markup is 20%, you pay $120. Margin is the percentage of the final price that\'s profit. Same $120 has a 16.7% margin. Markup and margin are different numbers for the same thing.',
  'gc-fee': 'Your general contractor charges a fee for managing the entire project — coordinating trades, handling permits, solving problems, and keeping everything on schedule and budget. This is typically 15-25% of construction costs or a flat fee.',
  'allowance': 'An allowance is a placeholder budget amount for items you haven\'t picked yet (like light fixtures, countertops, or tile). If your selections cost more than the allowance, you pay the difference. If less, you save money.',
  'draw-schedule': 'A draw schedule ties payments to completed milestones. Instead of paying everything upfront, you release money as work gets done — foundation complete, framing done, etc. This protects you and ensures the builder stays motivated.',
  'lien-waiver': 'A lien waiver is a document from a contractor or supplier confirming they\'ve been paid and won\'t file a lien (legal claim) against your property. Always collect lien waivers with each payment to protect yourself.',
  'critical-path': 'The critical path is the longest sequence of tasks that determines your project\'s minimum timeline. If any task on the critical path is delayed, the whole project gets delayed. Other tasks have "float" — they can slip without affecting the end date.',
  'bid-spread': 'Bid spread is the difference between the lowest and highest bids for the same scope of work. A large spread (over 30%) may mean the scope wasn\'t clear enough, or one bidder is significantly over/under market rate.',
  'inspection': 'Building inspections are required checkpoints where a city inspector verifies the work meets code. They happen at specific stages — foundation, framing, rough plumbing/electrical, insulation, and final. You can\'t proceed until each passes.',
  'lead-time': 'Lead time is how long it takes from ordering a material to receiving it. Custom cabinets might have an 8-week lead time, while standard lumber is usually available within days. Planning around lead times prevents schedule delays.',
};

export function getEducationContent(topic: string): string | null {
  const normalized = topic.toLowerCase().replace(/[^a-z-]/g, '');
  return EDUCATION_CONTENT[normalized] ?? null;
}

export function getAllTopics(): string[] {
  return Object.keys(EDUCATION_CONTENT);
}
