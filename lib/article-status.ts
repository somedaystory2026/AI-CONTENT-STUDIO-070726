import type { ArticleStatus } from "@/types/content";

const memoryStatus = new Map<string, ArticleStatus>();

export function getArticleStatus(id: string): ArticleStatus {
  return memoryStatus.get(id) || "collected";
}

export function setArticleStatus(id: string, status: ArticleStatus) {
  memoryStatus.set(id, status);
}
