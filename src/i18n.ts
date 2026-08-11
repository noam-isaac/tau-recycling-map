import type { GeolocationStatus, Locale } from "@/data/types";

export interface AppCopy {
  title: string;
  campus: string;
  points: string;
  all: string;
  homeEyebrow: string;
  homeTitle: string;
  homeIntro: string;
  openAll: string;
  back: string;
  navigateNearest: string;
  navigateHint: string;
  locating: string;
  close: string;
  locationPhoto: string;
  noDescription: string;
  distance: string;
  direction: string;
  directionLive: string;
  directionStarting: string;
  directionUnavailable: string;
  directions: string;
  useLocation: string;
  indoor: string;
  denied: string;
  unavailable: string;
  timeout: string;
  unsupported: string;
  accuracy: string;
  selected: string;
  nearest: string;
  retry: string;
  mapLabel: string;
  zoomIn: string;
  zoomOut: string;
  languageSwitcher: string;
}

export const appCopy = {
  he: {
    title: "מפת המיחזור",
    campus: "אוניברסיטת תל אביב",
    points: "נקודות מיחזור בקמפוס",
    all: "כל סוגי הפחים",
    homeEyebrow: "מפת המיחזור בקמפוס",
    homeTitle: "איזה פח מחפשים?",
    homeIntro: "בחרו סוג פח כדי לפתוח את המפה המתאימה",
    openAll: "פתיחת מפת כל הפחים",
    back: "חזרה למפה הראשית",
    navigateNearest: "ניווט לפח הקרוב",
    navigateHint: "הצגת הפח הקרוב, המרחק והכיוון",
    locating: "מאתר אותך…",
    close: "סגירה",
    locationPhoto: "תמונה של נקודת המיחזור",
    noDescription: "אין תיאור נוסף",
    distance: "מרחק",
    direction: "חץ הכיוון לפח",
    directionLive: "החץ מתעדכן לפי כיוון הטלפון",
    directionStarting: "ממתין לנתוני המצפן…",
    directionUnavailable: "אין גישה למצפן — מוצג מרחק בלבד",
    directions: "מסלול הליכה ב-Google Maps",
    useLocation: "הצגת מרחק וכיוון מהמיקום שלי",
    indoor:
      "ייתכן שהנקודה מסמנת את אזור הבניין. התיאור מפרט את הקומה או החדר המדויקים.",
    denied: "הגישה למיקום נחסמה. אפשר לאשר אותה בהגדרות הדפדפן.",
    unavailable: "לא הצלחנו לזהות את המיקום במכשיר הזה.",
    timeout: "זיהוי המיקום ארך יותר מדי זמן. אפשר לנסות שוב.",
    unsupported: "הדפדפן הזה לא תומך בשיתוף מיקום.",
    accuracy: "דיוק משוער",
    selected: "פרטי נקודת המיחזור",
    nearest: "נקודת המיחזור הקרובה אליי",
    retry: "ניסיון נוסף",
    mapLabel: "מפת נקודות מיחזור",
    zoomIn: "התקרבות",
    zoomOut: "התרחקות",
    languageSwitcher: "שפה",
  },
  en: {
    title: "Recycling map",
    campus: "Tel Aviv University",
    points: "campus recycling points",
    all: "All bin types",
    homeEyebrow: "Campus recycling map",
    homeTitle: "Which bin are you looking for?",
    homeIntro: "Choose a bin type to open its map",
    openAll: "Open the map with all bins",
    back: "Back to main map",
    navigateNearest: "Navigate to the nearest bin",
    navigateHint: "Show the nearest bin, distance, and direction",
    locating: "Finding you…",
    close: "Close",
    locationPhoto: "Photo of the recycling point",
    noDescription: "No additional description",
    distance: "Distance",
    direction: "Direction arrow to the bin",
    directionLive: "The arrow updates with your phone's direction",
    directionStarting: "Waiting for compass data…",
    directionUnavailable: "Compass unavailable — showing distance only",
    directions: "Walking directions in Google Maps",
    useLocation: "Show distance and direction from me",
    indoor:
      "The pin may mark the building area. Follow the Hebrew note for the exact floor or room.",
    denied: "Location access was denied. You can allow it in your browser settings.",
    unavailable: "Your location could not be determined on this device.",
    timeout: "Location took too long. You can try again.",
    unsupported: "This browser does not support location sharing.",
    accuracy: "Estimated accuracy",
    selected: "Recycling point details",
    nearest: "Nearest recycling point to me",
    retry: "Try again",
    mapLabel: "Recycling locations map",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    languageSwitcher: "Language",
  },
} satisfies Record<Locale, AppCopy>;

export function geolocationErrorMessage(
  status: GeolocationStatus,
  locale: Locale,
): string | null {
  const copy = appCopy[locale];
  switch (status) {
    case "denied":
      return copy.denied;
    case "unavailable":
      return copy.unavailable;
    case "timeout":
      return copy.timeout;
    case "unsupported":
      return copy.unsupported;
    default:
      return null;
  }
}
