import type { LibraryItem, LibraryItemType } from "@/types/content";
import { createClientId, readJson, writeJson } from "@/lib/browser-storage";

export const LIBRARY_STORAGE_KEY = "aiContentStudioLibrary";

export function getLibraryItems() {
  return readJson<LibraryItem[]>(LIBRARY_STORAGE_KEY, []);
}

export function saveLibraryItem(input: {
  id?: string;
  type: LibraryItemType;
  title: string;
  description?: string;
  source?: string;
  payload: unknown;
}) {
  const now = new Date().toISOString();
  const items = getLibraryItems();
  const id = input.id || createClientId(input.type);
  const existingIndex = items.findIndex((item) => item.id === id);

  const nextItem: LibraryItem = {
    id,
    type: input.type,
    title: input.title,
    description: input.description,
    source: input.source,
    payload: input.payload,
    createdAt: existingIndex >= 0 ? items[existingIndex].createdAt : now,
    updatedAt: now,
  };

  const nextItems = existingIndex >= 0 ? items.map((item) => (item.id === id ? nextItem : item)) : [nextItem, ...items];
  writeJson(LIBRARY_STORAGE_KEY, nextItems);
  return nextItem;
}

export function deleteLibraryItem(id: string) {
  writeJson(
    LIBRARY_STORAGE_KEY,
    getLibraryItems().filter((item) => item.id !== id)
  );
}

export function getLibraryTypeLabel(type: LibraryItemType) {
  const map: Record<LibraryItemType, string> = {
    article: "기사",
    "ai-result": "AI 결과",
    "card-news": "카드뉴스",
    image: "이미지",
    sns: "SNS",
  };

  return map[type];
}
