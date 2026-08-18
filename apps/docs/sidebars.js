// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  lectaSidebar: [
    {
      type: 'category',
      label: 'Introducción',
      collapsed: false,
      items: [
        'introduction/what-is-lecta',
        'introduction/goals',
        'introduction/principles',
        'introduction/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Arquitectura',
      items: [
        'architecture/system-overview',
        'architecture/ARCHITECTURE',
        'architecture/processes',
        'architecture/ipc',
        'architecture/database',
        'architecture/recording',
        'architecture/transcription',
        'architecture/ai',
        'architecture/knowledge-retrieval',
        'architecture/workers',
        'architecture/security',
        'architecture/ERRORS-AND-RECOVERY',
      ],
    },
    {
      type: 'category',
      label: 'Desarrollo',
      items: [
        'development/setup-local',
        'development/commands',
        'development/repository-structure',
        'development/GITHUB',
        'development/testing',
        'development/environment-variables',
        'development/debugging',
        'development/documentation',
      ],
    },
    {
      type: 'category',
      label: 'Producto',
      items: ['product/user-flows', 'product/product-states', 'product/information-architecture'],
    },
    {
      type: 'category',
      label: 'Diseño',
      items: [
        'design/ux-principles',
        'design/design-system',
        'design/tokens',
        'design/components',
        'accessibility/ACCESSIBILITY',
        'design/UX-UI-AUDIT',
        'design/UI-REDESIGN-PLAN',
      ],
    },
    {
      type: 'category',
      label: 'Quality',
      items: [
        'audits/QUALITY-AUDIT',
        'quality/testing-strategy',
        'performance/PERFORMANCE',
        'performance/KNOWLEDGE-WORKER',
        'quality/security',
      ],
    },
    {
      type: 'category',
      label: 'Decisiones',
      items: [
        'adr/index',
        'adr/ADR-001-architecture',
        'adr/ADR-002-local-first',
        'adr/ADR-003-electron',
        'adr/ADR-004-windows-audio-capture',
        'adr/ADR-005-offline-transcription',
        'adr/ADR-006-ai-notes',
        'adr/ADR-007-library-search',
        'adr/ADR-008-semantic-knowledge',
        'adr/ADR-knowledge-worker',
        'adr/ADR-e2e-test-seam',
      ],
    },
    {
      type: 'category',
      label: 'Prompts',
      items: [
        'prompts/introduction',
        'prompts/prompt-0',
        'prompts/prompt-1',
        'prompts/audit-prompts',
        'prompts/ui-prompts',
      ],
    },
    {
      type: 'category',
      label: 'Roadmap',
      items: [
        'roadmap/current-state',
        'roadmap/completed',
        'roadmap/in-progress',
        'roadmap/future',
      ],
    },
    { type: 'category', label: 'Changelog', items: ['changelog/releases'] },
  ],
};

module.exports = sidebars;
