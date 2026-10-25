import type { PrayerName } from "@/lib/prayers";

export type BilingualText = {
  en: string;
  ur: string;
};

export const PRAYER_URDU: Record<PrayerName, string> = {
  Fajr: "فجر",
  Dhuhr: "ظہر",
  Asr: "عصر",
  Maghrib: "مغرب",
  Isha: "عشاء",
  "Jumu'ah": "جمعہ",
};

export const publicCopy = {
  nextJamaat: { en: "Next jamaat", ur: "اگلی جماعت" },
  todaysTimes: { en: "Today's jamaat times", ur: "آج کے جماعت کے اوقات" },
  timesNotPosted: { en: "Times not posted yet", ur: "اوقات ابھی درج نہیں" },
  timesNotPostedDetail: {
    en: "Today's jamaat times have not been posted yet.",
    ur: "آج کے جماعت کے اوقات ابھی درج نہیں ہوئے۔",
  },
  calculating: { en: "Calculating…", ur: "حساب ہو رہا ہے…" },
  tomorrow: { en: "tomorrow", ur: "کل" },
  prayer: { en: "Prayer", ur: "نماز" },
  jamaat: { en: "Jamaat", ur: "جماعت" },
  nextBadge: { en: "Next", ur: "اگلی" },
  fridayBadge: { en: "Friday", ur: "جمعہ" },
  today: { en: "Today", ur: "آج" },
  notify: { en: "Notify me if jamaat changes", ur: "جماعت بدلے تو اطلاع دیں" },
  alertsAfterPosting: {
    en: "Alerts available once today's times are posted",
    ur: "آج کے اوقات درج ہونے کے بعد اطلاع دستیاب ہوگی",
  },
  checkingAlerts: { en: "Checking alerts…", ur: "اطلاع چیک ہو رہی ہے…" },
  enablingAlerts: { en: "Enabling…", ur: "فعال ہو رہا ہے…" },
  alertsBlocked: { en: "Alerts blocked", ur: "اطلاعات بند ہیں" },
  alertsUnavailable: { en: "Alerts unavailable", ur: "اطلاعات دستیاب نہیں" },
  disablingAlerts: { en: "Disabling alerts", ur: "اطلاعات بند ہو رہی ہیں" },
  disableAlerts: { en: "Disable alerts", ur: "اطلاعات بند کریں" },
  keepHandy: { en: "Keep jamaat times handy", ur: "جماعت کے اوقات ساتھ رکھیں" },
  installHelp: {
    en: "Add this app for fast access, even with a weak connection.",
    ur: "کمزور کنکشن پر بھی فوری رسائی کے لیے یہ ایپ شامل کریں۔",
  },
  installApp: { en: "Install this app", ur: "یہ ایپ انسٹال کریں" },
  offline: {
    en: "The latest jamaat times remain available offline.",
    ur: "تازہ جماعت کے اوقات آف لائن بھی دستیاب رہتے ہیں۔",
  },
  footer: {
    en: "Always check the date when a jamaat time changes.",
    ur: "جماعت کا وقت بدلے تو تاریخ ضرور دیکھ لیں۔",
  },
  unposted: {
    en: "No times are shown until they are posted.",
    ur: "اوقات درج ہونے تک نہیں دکھائے جاتے۔",
  },
  refreshTimes: { en: "Refresh times", ur: "اوقات تازہ کریں" },
  refreshingTimes: { en: "Refreshing times", ur: "اوقات تازہ ہو رہے ہیں" },
  appOptions: { en: "App options", ur: "ایپ کے اختیارات" },
  dismiss: { en: "Dismiss message", ur: "پیغام بند کریں" },
  jamaatChanged: {
    en: "A jamaat time changed. Times have been refreshed.",
    ur: "جماعت کا وقت بدل گیا۔ اوقات تازہ کر دیے گئے۔",
  },
  alertsAfterPostingToast: {
    en: "Alerts will be available once today's jamaat times are posted.",
    ur: "آج کے جماعت کے اوقات درج ہونے کے بعد اطلاعات دستیاب ہوں گی۔",
  },
  pushUnsupported: {
    en: "This browser does not support web push notifications.",
    ur: "یہ براؤزر ویب اطلاعات کی سہولت نہیں دیتا۔",
  },
  alertsEnabled: {
    en: "Alerts are enabled on this device.",
    ur: "اس ڈیوائس پر اطلاعات فعال ہو گئی ہیں۔",
  },
  alertsEnableFailed: {
    en: "Notifications could not be enabled.",
    ur: "اطلاعات فعال نہیں ہو سکیں۔",
  },
  alertsDisabled: {
    en: "Alerts are disabled on this device.",
    ur: "اس ڈیوائس پر اطلاعات بند ہو گئی ہیں۔",
  },
  alertsDisableFailed: {
    en: "Alerts could not be disabled.",
    ur: "اطلاعات بند نہیں ہو سکیں۔",
  },
  refreshing: { en: "Refreshing times…", ur: "اوقات تازہ ہو رہے ہیں…" },
  refreshed: { en: "Jamaat times refreshed.", ur: "جماعت کے اوقات تازہ ہو گئے۔" },
  refreshFailed: {
    en: "Jamaat times could not be refreshed. Please try again.",
    ur: "جماعت کے اوقات تازہ نہیں ہو سکے۔ دوبارہ کوشش کریں۔",
  },
  installHint: {
    en: "On iPhone, use Share → Add to Home Screen. On Android, open the browser menu and choose Install app.",
    ur: "آئی فون پر شیئر سے ہوم اسکرین پر شامل کریں۔ اینڈرائیڈ پر براؤزر مینو سے ایپ انسٹال کریں۔",
  },
} satisfies Record<string, BilingualText>;

export function remainingCopy(hours: number, minutes: number, tomorrow: boolean): BilingualText {
  const tomorrowEn = tomorrow ? ` · ${publicCopy.tomorrow.en}` : "";
  const tomorrowUr = tomorrow ? ` · ${publicCopy.tomorrow.ur}` : "";
  const hourWord = hours === 1 ? "گھنٹہ" : "گھنٹے";
  const number = (value: number) => `\u2066${value}\u2069`;
  const parts = [
    hours > 0 ? `${number(hours)} ${hourWord}` : "",
    minutes > 0 || hours === 0 ? `${number(minutes)} منٹ` : "",
    "باقی",
  ].filter(Boolean);

  return {
    en: `${hours}h ${minutes}m remaining${tomorrowEn}`,
    ur: `${parts.join(" ")}${tomorrowUr}`,
  };
}

export function updatedCopy(when: string): BilingualText {
  return {
    en: `Updated ${when}`,
    ur: `تازہ کاری ${when}`,
  };
}
