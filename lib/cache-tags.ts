export const PRAYER_SCHEDULE_CACHE_TAG = "prayer-schedules";
export const MOSQUE_DIRECTORY_CACHE_TAG = "mosques";

export function prayerScheduleCacheTag(mosqueId: string) {
  return `${PRAYER_SCHEDULE_CACHE_TAG}:${mosqueId}`;
}
