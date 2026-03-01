// ============================================================
// useLanguage — Reactive i18n hook
// Reads from localStorage "arogyasutra_language".
// Components re-render on language change via a custom event.
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TRANSLATIONS,
    getStoredLang,
    setStoredLang,
    type SupportedLang,
    type Translations,
} from "../lib/i18n/translations";

const LANG_CHANGE_EVENT = "arogyasutra:langchange";

/** Broadcast a language change so all hook instances re-render */
export function broadcastLangChange(lang: SupportedLang) {
    setStoredLang(lang);
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

export function useLanguage() {
    const [lang, setLang] = useState<SupportedLang>(() => getStoredLang());

    useEffect(() => {
        // Hydrate from localStorage on mount (catches server/client mismatch)
        setLang(getStoredLang());

        const handler = (e: Event) => {
            setLang((e as CustomEvent<SupportedLang>).detail);
        };
        window.addEventListener(LANG_CHANGE_EVENT, handler);
        return () => window.removeEventListener(LANG_CHANGE_EVENT, handler);
    }, []);

    const t = useCallback(
        (key: keyof Translations): string => {
            return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key];
        },
        [lang]
    );

    return { lang, t };
}
