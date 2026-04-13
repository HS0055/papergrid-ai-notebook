export interface CommunityNewsLike {
  _id: string;
  createdAt: string;
  pinnedAt?: string;
}

const COMMUNITY_NEWS_SEEN_PREFIX = 'papergrid_community_news_seen_v1';

function getSeenKey(userId: string): string {
  return `${COMMUNITY_NEWS_SEEN_PREFIX}_${userId}`;
}

export function sortCommunityNews<T extends CommunityNewsLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
    const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getLatestCommunityNewsTimestamp<T extends CommunityNewsLike>(items: T[]): string | null {
  if (items.length === 0) return null;

  let latestItem = items[0];
  let latestMs = new Date(items[0].createdAt).getTime();

  for (const item of items.slice(1)) {
    const createdAtMs = new Date(item.createdAt).getTime();
    if (createdAtMs > latestMs) {
      latestMs = createdAtMs;
      latestItem = item;
    }
  }

  return latestItem.createdAt;
}

export function getSeenCommunityNewsAt(userId?: string | null): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  return window.localStorage.getItem(getSeenKey(userId));
}

export function markCommunityNewsSeen(userId: string, seenAt: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getSeenKey(userId), seenAt);
}

export function getUnreadCommunityNewsCount<T extends CommunityNewsLike>(
  items: T[],
  seenAt?: string | null,
): number {
  if (items.length === 0) return 0;
  if (!seenAt) return items.length;

  const seenMs = new Date(seenAt).getTime();
  if (!Number.isFinite(seenMs)) return items.length;

  return items.reduce((count, item) => (
    new Date(item.createdAt).getTime() > seenMs ? count + 1 : count
  ), 0);
}
