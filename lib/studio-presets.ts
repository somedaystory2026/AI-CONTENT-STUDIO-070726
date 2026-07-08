export type PromptPreset = {
  id: string;
  name: string;
  category: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
};

export const promptPresets: PromptPreset[] = [
  {
    id: "seo-blog",
    name: "SEO Blog Writer",
    category: "Writing",
    systemPrompt: "You are a senior SEO content strategist. Write practical, structured, original content.",
    userPrompt: "Write an SEO article about {{keyword}} for {{audience}} in {{language}}. Tone: {{tone}}.",
    variables: ["keyword", "audience", "language", "tone"],
  },
  {
    id: "card-news-script",
    name: "Card News Script",
    category: "Card News",
    systemPrompt: "You create concise social card news copy with clear hooks and short paragraphs.",
    userPrompt: "Turn this article into {{count}} card news slides. Topic: {{title}}. Key content: {{content}}.",
    variables: ["count", "title", "content"],
  },
  {
    id: "amazon-listing",
    name: "Amazon Listing SEO",
    category: "Amazon",
    systemPrompt: "You are an Amazon listing SEO specialist. Follow marketplace listing best practices.",
    userPrompt: "Create title, bullets, backend keywords, HTML description, and FAQ for {{product}}. Market: {{market}}.",
    variables: ["product", "market"],
  },
  {
    id: "rss-summary",
    name: "RSS News Summary",
    category: "News",
    systemPrompt: "You summarize news objectively and explain why it matters.",
    userPrompt: "Summarize and rewrite this news in {{language}}. Text: {{article}}.",
    variables: ["language", "article"],
  },
];

export const cardTemplates = [
  { id: "midnight-news", name: "Midnight News", category: "News", background: "#020617", accent: "#2563eb", foreground: "#ffffff" },
  { id: "clean-business", name: "Clean Business", category: "Business", background: "#f8fafc", accent: "#0f172a", foreground: "#111827" },
  { id: "creator-pop", name: "Creator Pop", category: "SNS", background: "linear-gradient(135deg,#7c3aed,#db2777)", accent: "#fde047", foreground: "#ffffff" },
  { id: "church-warm", name: "Church Warm", category: "Church", background: "linear-gradient(135deg,#92400e,#f59e0b)", accent: "#fff7ed", foreground: "#ffffff" },
  { id: "finance-pro", name: "Finance Pro", category: "Finance", background: "#022c22", accent: "#10b981", foreground: "#ecfdf5" },
  { id: "sports-score", name: "Sports Score", category: "Sports", background: "#111827", accent: "#ef4444", foreground: "#ffffff" },
  { id: "fashion-soft", name: "Fashion Soft", category: "Fashion", background: "#fff1f2", accent: "#e11d48", foreground: "#4c0519" },
  { id: "tech-grid", name: "Tech Grid", category: "Tech", background: "#0f172a", accent: "#38bdf8", foreground: "#e0f2fe" },
];

export const brandKits = [
  { id: "dark-saas", name: "Dark SaaS", font: "Inter", primary: "#2563eb", secondary: "#0f172a", radius: 24 },
  { id: "korean-news", name: "Korean News", font: "Pretendard", primary: "#dc2626", secondary: "#111827", radius: 16 },
  { id: "creator-neon", name: "Creator Neon", font: "Inter", primary: "#a855f7", secondary: "#ec4899", radius: 28 },
];
