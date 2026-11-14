export interface AudiencePage {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  lead: string;
  accent: string;
  intro: string;
  scenario: string;
  signals: string[];
  benefits: { title: string; detail: string }[];
  steps: { title: string; detail: string }[];
  fit: string[];
  boundaries: string[];
  faqs: { question: string; answer: string }[];
  closing: string;
}

export const audiencePages: Record<string, AudiencePage> = {
  startups: {
    slug: 'startups',
    title: 'Security and compliance readiness for seed-stage startups',
    description: 'Practical SOC 2 and customer-security readiness for seed-stage B2B startups: scope the gaps, prioritize remediation, and prepare evidence for independent review.',
    eyebrow: 'Seed-stage and Series A teams',
    lead: 'Security readiness for startups',
    accent: 'that need to keep shipping.',
    intro: 'Your first enterprise security review should lead to a clear plan, not an unbounded compliance project. Canonical Plus helps lean B2B teams scope requirements, locate control and evidence gaps, and decide what to work on first.',
    scenario: 'You have a small product team, serious customer conversations, and limited time for new security processes. You need the facts before buying more software or hiring a dedicated compliance team.',
    signals: ['A customer sent a security questionnaire or requested SOC 2 documentation', 'A new sales motion involves regulated or security-conscious buyers', 'Your CTO needs an engineering-ready remediation backlog'],
    benefits: [
      { title: 'Separate urgent from optional', detail: 'Map current customer requirements and target frameworks to the systems and controls actually in scope.' },
      { title: 'Protect engineering time', detail: 'Turn findings into sequenced cloud, identity, SDLC, and evidence work with clear owners and dependencies.' },
      { title: 'Prepare a credible handoff', detail: 'Organize available evidence and open issues for customer review or a qualified independent assessor.' }
    ],
    steps: [
      { title: 'Start with the buying trigger', detail: 'Identify the customer request, decision timeline, requested frameworks, and evidence you already have.' },
      { title: 'Scope a focused gap assessment', detail: 'Review the relevant architecture, control ownership, policies, and evidence sources before committing to a larger program.' },
      { title: 'Prioritize and execute', detail: 'Use a documented remediation roadmap; expand to managed readiness or engineering support only if the scope warrants it.' }
    ],
    fit: ['Seed-funded or Series A B2B SaaS and AI teams', 'Developer tools and cloud products facing enterprise procurement', 'Startups with technical ownership but no dedicated GRC team'],
    boundaries: ['An early-stage consumer product without a current security-driven buying or regulatory need may not need a full program.', 'A readiness engagement is not a SOC 2 report, certificate, authorization, or promise that a customer will approve a vendor.'],
    faqs: [
      { question: 'Do we need SOC 2 before the first enterprise deal?', answer: 'It depends on the buyer, the contract, your data, and your market. We can help clarify the actual request and distinguish required evidence from optional future work.' },
      { question: 'Can we start small?', answer: 'Yes. Request a scoped discussion focused on your immediate customer requirements. Any assessment, timeline, deliverables, and price are confirmed in a written statement of work.' }
    ],
    closing: 'Start with the security question your customer is actually asking.'
  },
  founders: {
    slug: 'founders',
    title: 'Compliance readiness for startup founders and CEOs',
    description: 'For startup founders and CEOs preparing for enterprise procurement: understand security gaps, budget deliberately, and coordinate practical remediation without a full-time GRC team.',
    eyebrow: 'For founders and CEOs',
    lead: 'Keep enterprise conversations moving',
    accent: 'without building a security department.',
    intro: 'When a prospective customer asks for your security posture, the founder often owns the response. We help translate that request into a scoped readiness decision your CTO, sales team, and advisors can act on.',
    scenario: 'You need to know whether a customer requirement is blocking a real opportunity, what work is necessary, who will own it, and what the budget could look like.',
    signals: ['An enterprise buyer asks for controls, policies, or independent assurance', 'You need to brief the board or leadership on security readiness risks', 'You are comparing compliance tooling, outside help, and hiring'],
    benefits: [
      { title: 'Know what matters to the deal', detail: 'Clarify the requested framework, customer evidence, contractual dependencies, and unresolved decisions.' },
      { title: 'Spend deliberately', detail: 'Prioritize the most relevant gaps before committing to a broad software subscription or dedicated hire.' },
      { title: 'Give the team a plan', detail: 'Connect business priorities to engineering tasks, owners, milestones, and independent-review handoff needs.' }
    ],
    steps: [
      { title: 'Review the commercial requirement', detail: 'Bring the questionnaire, procurement request, or customer conversation that created urgency.' },
      { title: 'Agree on a practical scope', detail: 'Document the systems, people, frameworks, and exclusions that influence effort and cost.' },
      { title: 'Decide what to do next', detail: 'Choose a focused assessment, managed readiness, or technical remediation scope based on actual needs.' }
    ],
    fit: ['Founder-led B2B startups pursuing larger contracts', 'CEOs coordinating a CTO, sales lead, and fractional finance team', 'Companies anticipating due diligence or new security requirements'],
    boundaries: ['We do not guarantee faster deal closure, contract awards, funding outcomes, or audit results.', 'Qualified independent reviewers—not Canonical Plus—issue formal assurance opinions, certifications, and authorizations.'],
    faqs: [
      { question: 'Should I involve our CTO?', answer: 'Yes. Founder-level priorities and technical scope should be aligned so security work is realistic and can be owned by engineering.' },
      { question: 'Can my CFO or COO join the discussion?', answer: 'Absolutely. A scoped readiness discussion benefits from budget, operating ownership, and customer context; formal fees are defined by the signed statement of work.' }
    ],
    closing: 'Turn an open-ended enterprise security request into a deliberate business decision.'
  },
  'sales-teams': {
    slug: 'sales-teams',
    title: 'Enterprise security questionnaire readiness for sales teams',
    description: 'Support for startup sales and revenue leaders navigating enterprise security questionnaires, procurement reviews, and evidence requests without overstating compliance claims.',
    eyebrow: 'For heads of sales and revenue',
    lead: 'Security reviews should be managed',
    accent: 'with facts, not guesswork.',
    intro: 'Enterprise procurement can ask for detailed security evidence long before a small team has a mature compliance function. Canonical Plus helps identify what is documented, what is missing, and which technical gaps need an owner.',
    scenario: 'A buyer has sent a questionnaire or asked for an independent report. Sales needs a defensible response plan without inventing controls or promising certifications the company does not hold.',
    signals: ['A security questionnaire has no clear internal owner', 'A customer requests control evidence or an audit report', 'Engineering is getting unstructured last-minute security requests'],
    benefits: [
      { title: 'Organize the request', detail: 'Identify requested claims, documents, evidence dates, and unresolved questions in one scoped register.' },
      { title: 'Escalate the right gaps', detail: 'Give technical and operational owners a prioritized remediation list instead of forwarding an entire questionnaire.' },
      { title: 'Communicate accurately', detail: 'Distinguish implemented controls, incomplete evidence, planned work, and external assurance that has not yet been obtained.' }
    ],
    steps: [
      { title: 'Inventory the customer questions', detail: 'Gather the questionnaire, contractual asks, and evidence requests; preserve the actual wording.' },
      { title: 'Check each claim against evidence', detail: 'Route technical, privacy, and contractual issues to the responsible owners and record unanswered items.' },
      { title: 'Plan remediation and follow-up', detail: 'Prepare an evidence handoff and a clear statement of what is verified, outstanding, and subject to independent review.' }
    ],
    fit: ['B2B sales teams selling to regulated or enterprise customers', 'Revenue leaders without dedicated deal-desk security support', 'Founders directly handling vendor-risk reviews'],
    boundaries: ['We do not fabricate questionnaire answers or represent planned controls as already implemented.', 'Readiness support cannot guarantee procurement approval, a signed contract, or an independent assurance outcome.'],
    faqs: [
      { question: 'Will Canonical Plus fill out our questionnaire?', answer: 'We can help scope supporting evidence and identify gaps and owners. Any response must be verified and approved by your organization before it is sent.' },
      { question: 'What if the customer asks for a SOC 2 report we do not have?', answer: 'The response must accurately state the current status. We can help plan readiness and a qualified independent-auditor handoff, but cannot issue or substitute for a SOC 2 report.' }
    ],
    closing: 'Give your sales team a trustworthy path through security due diligence.'
  },
  'technical-founders': {
    slug: 'technical-founders',
    title: 'Engineering-first compliance readiness for technical founders',
    description: 'Security readiness for startup CTOs and technical founders: practical cloud, IAM, CI/CD, logging, and evidence remediation planning that respects engineering capacity.',
    eyebrow: 'For CTOs and technical co-founders',
    lead: 'Translate security requirements',
    accent: 'into work your team can ship.',
    intro: 'Compliance requirements become useful when they turn into specific engineering decisions. We focus on real architecture, existing controls, evidence sources, and a backlog that fits your team.',
    scenario: 'You own the product, infrastructure, and on-call rotation. The next customer asks for evidence about access control, deployment practices, incident handling, or data retention.',
    signals: ['You need to identify cloud or identity control gaps', 'Your product has grown faster than your evidence processes', 'Compliance tooling is creating noise without clear engineering priorities'],
    benefits: [
      { title: 'Architecture-aware scoping', detail: 'Review relevant cloud accounts, applications, identities, data flows, suppliers, and ownership boundaries.' },
      { title: 'Concrete technical tasks', detail: 'Translate findings into testable remediation work across IAM, CI/CD, logging, backups, and operational controls where applicable.' },
      { title: 'Evidence without busywork', detail: 'Define sources of truth and freshness expectations so future requests can reuse genuine engineering records.' }
    ],
    steps: [
      { title: 'Map systems and requirements', detail: 'Connect the target control set to the architecture and actual data handled by the product.' },
      { title: 'Separate code gaps from proof gaps', detail: 'Mark controls as implemented, partially implemented, absent, or unverified rather than relying on a generic score.' },
      { title: 'Prioritize remediation', detail: 'Agree on risk, dependencies, owners, and acceptance criteria before changing production systems.' }
    ],
    fit: ['Small engineering teams with direct ownership of cloud infrastructure', 'Technical founders preparing for enterprise security assessment', 'Companies that need a practical bridge between GRC and engineering'],
    boundaries: ['Technical remediation depends on the agreed scope, access, and customer approvals; no production changes are implied by a marketing inquiry.', 'This is preparation and engineering support, not an independent audit opinion or certification.'],
    faqs: [
      { question: 'Do we need to adopt a new GRC platform?', answer: 'Not necessarily. We first assess the requirements, evidence sources, and current workflows, and recommend tools only where they fit the scope.' },
      { question: 'Can you work with our existing stack?', answer: 'A technical scoping call will determine the relevant systems and the support that makes sense. Specific integrations or remediation commitments belong in the signed statement of work.' }
    ],
    closing: 'Make each readiness finding actionable for the people who own the systems.'
  },
  'vc-portfolios': {
    slug: 'vc-portfolios',
    title: 'Startup compliance readiness for VC portfolios and accelerators',
    description: 'A practical security-readiness referral and portfolio-support path for seed-stage venture funds, accelerators, and startup studios helping B2B founders sell to enterprise buyers.',
    eyebrow: 'For venture funds and accelerators',
    lead: 'Help portfolio founders approach security',
    accent: 'before it becomes a sales bottleneck.',
    intro: 'Portfolio companies often face similar enterprise-security questions at different stages. Canonical Plus can discuss a consistent, scope-first way for founders to assess their gaps and plan technical work.',
    scenario: 'Your founders are building B2B products and encountering customer-risk reviews. You want a reliable place to send them for a scoped discussion without imposing a one-size-fits-all program.',
    signals: ['Multiple portfolio teams are entering enterprise sales', 'Founders ask for help interpreting security or compliance requirements', 'An accelerator or studio wants a repeatable readiness introduction'],
    benefits: [
      { title: 'A practical referral path', detail: 'Give portfolio companies a concrete place to start with customer requirements and technical context.' },
      { title: 'Company-specific scoping', detail: 'Allow each startup to select readiness priorities based on its buyers, systems, data, and current maturity.' },
      { title: 'Clear commercial boundaries', detail: 'Discuss introductions, workshops, or coordinated scopes without assuming partnership status or automatic portfolio discounts.' }
    ],
    steps: [
      { title: 'Describe the portfolio need', detail: 'Share the company stages, industries, and common customer-security requests you are seeing.' },
      { title: 'Pilot a founder introduction', detail: 'Identify one or more willing startups and arrange a readiness-scoping conversation.' },
      { title: 'Evaluate a repeatable program', detail: 'If a larger pattern emerges, document any proposed workshops, referral process, responsibilities, and pricing separately.' }
    ],
    fit: ['Seed-stage venture funds with enterprise-focused portfolio companies', 'Accelerators and startup studios with B2B SaaS or AI cohorts', 'Operating partners supporting security and procurement readiness'],
    boundaries: ['This page is an invitation to discuss a potential program, not a claim that any named VC fund is already a partner.', 'Company-specific consent, confidentiality, delivery scope, fees, and auditor independence must be handled explicitly before engagement.'],
    faqs: [
      { question: 'Do portfolio companies need to buy a shared package?', answer: 'No. Each company can begin with its own scoping conversation. Any fund-wide arrangement would be proposed separately and require agreement.' },
      { question: 'Are partnership or referral terms already established?', answer: 'Not by this page. Please contact us to discuss whether an introduction or potential coordinated program makes sense.' }
    ],
    closing: 'Make readiness support available when a founder actually needs it.'
  }
};

export const audienceLinks = [
  { slug: 'startups', label: 'Startups', teaser: 'A focused route from first security request to a scoped readiness plan.' },
  { slug: 'founders', label: 'Founders & CEOs', teaser: 'Align customer pressure, spend, and the technical next steps.' },
  { slug: 'sales-teams', label: 'Sales teams', teaser: 'Navigate enterprise questionnaires and procurement evidence requests.' },
  { slug: 'technical-founders', label: 'Technical founders', teaser: 'Turn requirements into engineering-owned remediation work.' },
  { slug: 'vc-portfolios', label: 'VC portfolios', teaser: 'Explore referral and portfolio-readiness support for B2B founders.' }
] as const;
