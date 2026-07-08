export type ArticleStatus = "collected" | "generated" | "carded" | "imaged" | "published";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  originalLink?: string;
  isGoogleNewsFallback?: boolean;
  pubDate: string;
  description: string;
  source: string;
  country: string;
  category: string;
  status: ArticleStatus;
};

export type SelectedArticle = NewsItem;

export type AiContentMode = "news" | "blog" | "sns" | "rewrite" | "translate";
export type AiContentTone = "professional" | "friendly" | "viral" | "premium" | "storytelling" | "seo";
export type AiContentLanguage = "ko" | "en" | "ko-en" | "ja" | "es";

export type AiResult = {
  title: string;
  summary: string;
  mainContent: string;
  cardNews: string[];
  twitter: string;
  instagram: string;
  threads: string;
  hashtags: string[];
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string[];
};

export type RssFeed = {
  name: string;
  url: string;
  country: string;
  category: string;
  language?: string;
};

export type CardNewsTone = "news" | "viral" | "premium" | "friendly";
export type CardNewsTheme = "dark" | "blue" | "purple" | "green" | "warm";
export type CardNewsRatio = "1:1" | "4:5" | "16:9";

export type CardNewsProject = {
  id: string;
  title: string;
  source?: string;
  article?: Partial<NewsItem>;
  cards: string[];
  tone: CardNewsTone;
  theme: CardNewsTheme;
  ratio: CardNewsRatio;
  createdAt: string;
  updatedAt: string;
};

export type ImageStudioDraft = {
  article?: Partial<NewsItem>;
  cards: string[];
  cardCount: number;
  projectId?: string;
  prompt?: string;
  headline?: string;
};

export type LibraryItemType = "article" | "ai-result" | "card-news" | "image" | "sns";

export type LibraryItem = {
  id: string;
  type: LibraryItemType;
  title: string;
  description?: string;
  source?: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};
