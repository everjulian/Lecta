// @ts-check

const { themes: prismThemes } = require('prism-react-renderer');

const repositoryUrl = 'https://github.com/everjulian/Lecta';
const deploymentUrl = process.env['DOCS_URL'] ?? 'http://localhost:3000';
const deploymentBaseUrl = process.env['DOCS_BASE_URL'] ?? '/';
const isProduction = process.env['NODE_ENV'] === 'production';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Lecta Docs',
  tagline: 'Documentación técnica y de producto',
  favicon: 'img/favicon.svg',
  url: deploymentUrl,
  baseUrl: deploymentBaseUrl,
  organizationName: 'everjulian',
  projectName: 'Lecta',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },
  i18n: { defaultLocale: 'es', locales: ['es'] },
  presets: [
    [
      'classic',
      {
        docs: {
          path: '../../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: `${repositoryUrl}/edit/main/docs/`,
          showLastUpdateAuthor: isProduction,
          showLastUpdateTime: isProduction,
        },
        blog: false,
        pages: false,
        sitemap: { changefreq: 'weekly', priority: 0.5 },
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        docsDir: '../../docs',
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: false,
        language: ['es', 'en'],
        hashed: true,
      },
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
    navbar: {
      title: 'Lecta Docs',
      logo: { alt: 'Lecta', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'lectaSidebar', position: 'left', label: 'Documentación' },
        { href: repositoryUrl, label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Lecta',
          items: [
            { label: 'Quick Start', to: '/introduction/quick-start' },
            { label: 'Arquitectura', to: '/architecture' },
            { label: 'Contribuir', href: `${repositoryUrl}/blob/main/CONTRIBUTING.md` },
          ],
        },
      ],
      copyright: `Documentación de Lecta · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'powershell', 'sql'],
    },
  },
};

module.exports = config;
