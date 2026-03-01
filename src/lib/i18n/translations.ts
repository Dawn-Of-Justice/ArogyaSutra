// ============================================================
// ArogyaSutra — UI Translations
// Supported: en, hi, ta, te, bn, mr, gu, kn
// ============================================================

export type SupportedLang = "en" | "hi" | "ta" | "te" | "bn" | "mr" | "gu" | "kn";

export interface Translations {
    // Nav labels
    nav_dashboard: string;
    nav_timeline: string;
    nav_assistant: string;
    nav_access: string;
    nav_help: string;
    nav_settings: string;
    nav_records: string;
    nav_group_menu: string;
    nav_group_account: string;
    // Topbar
    search_placeholder: string;
    // Notification panel
    notif_title: string;
    notif_mark_all: string;
    notif_view_all: string;
    // User card menu
    my_profile: string;
    sign_out: string;
    // Page titles (topbar heading)
    page_dashboard: string;
    page_doctor_dashboard: string;
    page_timeline: string;
    page_assistant: string;
    page_access: string;
    page_settings: string;
    page_help: string;
    page_notifications: string;
    page_profile: string;
    // Role labels
    role_patient: string;
    role_doctor: string;
}

const en: Translations = {
    nav_dashboard: "Dashboard",
    nav_timeline: "Timeline",
    nav_assistant: "AI Assistant",
    nav_access: "Access Log",
    nav_help: "Help",
    nav_settings: "Settings",
    nav_records: "Records",
    nav_group_menu: "Menu",
    nav_group_account: "Account",
    search_placeholder: "Find Anything...",
    notif_title: "Notifications",
    notif_mark_all: "Mark all read",
    notif_view_all: "View all notifications",
    my_profile: "My Profile",
    sign_out: "Sign Out",
    page_dashboard: "Dashboard",
    page_doctor_dashboard: "Doctor Dashboard",
    page_timeline: "Timeline",
    page_assistant: "AI Assistant",
    page_access: "Access Log",
    page_settings: "Settings",
    page_help: "Help & Support",
    page_notifications: "Notifications",
    page_profile: "Profile",
    role_patient: "Patient",
    role_doctor: "Doctor",
};

const hi: Translations = {
    nav_dashboard: "डैशबोर्ड",
    nav_timeline: "टाइमलाइन",
    nav_assistant: "AI सहायक",
    nav_access: "एक्सेस लॉग",
    nav_help: "सहायता",
    nav_settings: "सेटिंग्स",
    nav_records: "रिकॉर्ड",
    nav_group_menu: "मेनू",
    nav_group_account: "खाता",
    search_placeholder: "कुछ भी खोजें...",
    notif_title: "सूचनाएं",
    notif_mark_all: "सभी पढ़ा हुआ चिह्नित करें",
    notif_view_all: "सभी सूचनाएं देखें",
    my_profile: "मेरी प्रोफ़ाइल",
    sign_out: "साइन आउट",
    page_dashboard: "डैशबोर्ड",
    page_doctor_dashboard: "डॉक्टर डैशबोर्ड",
    page_timeline: "टाइमलाइन",
    page_assistant: "AI सहायक",
    page_access: "एक्सेस लॉग",
    page_settings: "सेटिंग्स",
    page_help: "सहायता एवं समर्थन",
    page_notifications: "सूचनाएं",
    page_profile: "प्रोफ़ाइल",
    role_patient: "रोगी",
    role_doctor: "डॉक्टर",
};

const ta: Translations = {
    nav_dashboard: "டாஷ்போர்டு",
    nav_timeline: "காலவரிசை",
    nav_assistant: "AI உதவியாளர்",
    nav_access: "அணுகல் பதிவு",
    nav_help: "உதவி",
    nav_settings: "அமைப்புகள்",
    nav_records: "பதிவுகள்",
    nav_group_menu: "மெனு",
    nav_group_account: "கணக்கு",
    search_placeholder: "எதையும் தேடுங்கள்...",
    notif_title: "அறிவிப்புகள்",
    notif_mark_all: "அனைத்தும் படித்தாகவே கருதுக",
    notif_view_all: "அனைத்து அறிவிப்புகளையும் காண்க",
    my_profile: "என் சுயவிவரம்",
    sign_out: "வெளியேறு",
    page_dashboard: "டாஷ்போர்டு",
    page_doctor_dashboard: "மருத்துவர் டாஷ்போர்டு",
    page_timeline: "காலவரிசை",
    page_assistant: "AI உதவியாளர்",
    page_access: "அணுகல் பதிவு",
    page_settings: "அமைப்புகள்",
    page_help: "உதவி மற்றும் ஆதரவு",
    page_notifications: "அறிவிப்புகள்",
    page_profile: "சுயவிவரம்",
    role_patient: "நோயாளி",
    role_doctor: "மருத்துவர்",
};

const te: Translations = {
    nav_dashboard: "డాష్‌బోర్డ్",
    nav_timeline: "కాలక్రమం",
    nav_assistant: "AI సహాయకుడు",
    nav_access: "యాక్సెస్ లాగ్",
    nav_help: "సహాయం",
    nav_settings: "సెట్టింగులు",
    nav_records: "రికార్డులు",
    nav_group_menu: "మెనూ",
    nav_group_account: "ఖాతా",
    search_placeholder: "ఏదైనా వెతకండి...",
    notif_title: "నోటిఫికేషన్లు",
    notif_mark_all: "అన్నీ చదివినట్లు గుర్తించు",
    notif_view_all: "అన్ని నోటిఫికేషన్లు చూడండి",
    my_profile: "నా ప్రొఫైల్",
    sign_out: "సైన్ అవుట్",
    page_dashboard: "డాష్‌బోర్డ్",
    page_doctor_dashboard: "వైద్యుడి డాష్‌బోర్డ్",
    page_timeline: "కాలక్రమం",
    page_assistant: "AI సహాయకుడు",
    page_access: "యాక్సెస్ లాగ్",
    page_settings: "సెట్టింగులు",
    page_help: "సహాయం మరియు మద్దతు",
    page_notifications: "నోటిఫికేషన్లు",
    page_profile: "ప్రొఫైల్",
    role_patient: "రోగి",
    role_doctor: "వైద్యుడు",
};

const bn: Translations = {
    nav_dashboard: "ড্যাশবোর্ড",
    nav_timeline: "সময়রেখা",
    nav_assistant: "AI সহকারী",
    nav_access: "অ্যাক্সেস লগ",
    nav_help: "সহায়তা",
    nav_settings: "সেটিংস",
    nav_records: "রেকর্ড",
    nav_group_menu: "মেনু",
    nav_group_account: "অ্যাকাউন্ট",
    search_placeholder: "যেকোনো কিছু খুঁজুন...",
    notif_title: "বিজ্ঞপ্তি",
    notif_mark_all: "সব পড়া হিসেবে চিহ্নিত করুন",
    notif_view_all: "সব বিজ্ঞপ্তি দেখুন",
    my_profile: "আমার প্রোফাইল",
    sign_out: "সাইন আউট",
    page_dashboard: "ড্যাশবোর্ড",
    page_doctor_dashboard: "ডাক্তার ড্যাশবোর্ড",
    page_timeline: "সময়রেখা",
    page_assistant: "AI সহকারী",
    page_access: "অ্যাক্সেস লগ",
    page_settings: "সেটিংস",
    page_help: "সহায়তা এবং সমর্থন",
    page_notifications: "বিজ্ঞপ্তি",
    page_profile: "প্রোফাইল",
    role_patient: "রোগী",
    role_doctor: "ডাক্তার",
};

const mr: Translations = {
    nav_dashboard: "डॅशबोर्ड",
    nav_timeline: "कालरेषा",
    nav_assistant: "AI सहाय्यक",
    nav_access: "प्रवेश नोंद",
    nav_help: "मदत",
    nav_settings: "सेटिंग्ज",
    nav_records: "नोंदी",
    nav_group_menu: "मेनू",
    nav_group_account: "खाते",
    search_placeholder: "काहीही शोधा...",
    notif_title: "सूचना",
    notif_mark_all: "सर्व वाचले म्हणून चिन्हांकित करा",
    notif_view_all: "सर्व सूचना पाहा",
    my_profile: "माझी प्रोफाइल",
    sign_out: "साइन आउट",
    page_dashboard: "डॅशबोर्ड",
    page_doctor_dashboard: "डॉक्टर डॅशबोर्ड",
    page_timeline: "कालरेषा",
    page_assistant: "AI सहाय्यक",
    page_access: "प्रवेश नोंद",
    page_settings: "सेटिंग्ज",
    page_help: "मदत आणि समर्थन",
    page_notifications: "सूचना",
    page_profile: "प्रोफाइल",
    role_patient: "रुग्ण",
    role_doctor: "डॉक्टर",
};

const gu: Translations = {
    nav_dashboard: "ડૅશબોર્ડ",
    nav_timeline: "સમયરેખા",
    nav_assistant: "AI સહાયક",
    nav_access: "ઍક્સેસ લૉગ",
    nav_help: "સહાય",
    nav_settings: "સેટિંગ્સ",
    nav_records: "રેકોર્ડ",
    nav_group_menu: "મેનૂ",
    nav_group_account: "ખાતું",
    search_placeholder: "કંઈ પણ શોધો...",
    notif_title: "સૂચનાઓ",
    notif_mark_all: "બધા વાંચ્યા તરીકે ચિહ્નિત કરો",
    notif_view_all: "બધી સૂચનાઓ જુઓ",
    my_profile: "મારી પ્રોફાઇલ",
    sign_out: "સાઇન આઉટ",
    page_dashboard: "ડૅશબોર્ડ",
    page_doctor_dashboard: "ડૉક્ટર ડૅશબોર્ડ",
    page_timeline: "સમયરેખા",
    page_assistant: "AI સહાયક",
    page_access: "ઍક્સેસ લૉગ",
    page_settings: "સેટિંગ્સ",
    page_help: "સહાય અને સપોર્ટ",
    page_notifications: "સૂચનાઓ",
    page_profile: "પ્રોફાઇલ",
    role_patient: "દર્દી",
    role_doctor: "ડૉક્ટર",
};

const kn: Translations = {
    nav_dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    nav_timeline: "ಕಾಲಮಾಪಿ",
    nav_assistant: "AI ಸಹಾಯಕ",
    nav_access: "ಪ್ರವೇಶ ದಾಖಲೆ",
    nav_help: "ಸಹಾಯ",
    nav_settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    nav_records: "ದಾಖಲೆಗಳು",
    nav_group_menu: "ಮೆನು",
    nav_group_account: "ಖಾತೆ",
    search_placeholder: "ಯಾವುದಾದರೂ ಹುಡುಕಿ...",
    notif_title: "ಅಧಿಸೂಚನೆಗಳು",
    notif_mark_all: "ಎಲ್ಲವನ್ನೂ ಓದಿದ ರೀತಿ ಗುರುತಿಸಿ",
    notif_view_all: "ಎಲ್ಲ ಅಧಿಸೂಚನೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
    my_profile: "ನನ್ನ ಪ್ರೊಫೈಲ್",
    sign_out: "ಸೈನ್ ಔಟ್",
    page_dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    page_doctor_dashboard: "ವೈದ್ಯರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    page_timeline: "ಕಾಲಮಾಪಿ",
    page_assistant: "AI ಸಹಾಯಕ",
    page_access: "ಪ್ರವೇಶ ದಾಖಲೆ",
    page_settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    page_help: "ಸಹಾಯ ಮತ್ತು ಬೆಂಬಲ",
    page_notifications: "ಅಧಿಸೂಚನೆಗಳು",
    page_profile: "ಪ್ರೊಫೈಲ್",
    role_patient: "ರೋಗಿ",
    role_doctor: "ವೈದ್ಯರು",
};

export const TRANSLATIONS: Record<SupportedLang, Translations> = {
    en, hi, ta, te, bn, mr, gu, kn,
};

/** Get the browser-stored language, falling back to "en" */
export function getStoredLang(): SupportedLang {
    if (typeof window === "undefined") return "en";
    const v = localStorage.getItem("arogyasutra_language");
    return (v && v in TRANSLATIONS) ? (v as SupportedLang) : "en";
}

/** Persist language to localStorage AND set the html[lang] attribute */
export function setStoredLang(lang: SupportedLang) {
    localStorage.setItem("arogyasutra_language", lang);
    document.documentElement.setAttribute("lang", lang);
}
