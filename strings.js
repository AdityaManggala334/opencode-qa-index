// OpenCode itself is English-only (the OS locale only formats times), so the
// plugin defaults to English too and offers an explicit `language` option.
export const LANGUAGES = {
  en: {
    title: "History",
    empty: "No questions yet.",
    search: "search…",
    summaryTitle: "Session summary",
    summaryEmpty: "(empty summary)",
    summaryRow: "summary",
    pickerTitle: "Question history",
    pickerPlaceholder: "Search questions",
  },
  id: {
    title: "Riwayat",
    empty: "Belum ada pertanyaan.",
    search: "cari…",
    summaryTitle: "Ringkasan sesi",
    summaryEmpty: "(ringkasan kosong)",
    summaryRow: "ringkasan",
    pickerTitle: "Riwayat pertanyaan",
    pickerPlaceholder: "Cari pertanyaan",
  },
}

export const DEFAULT_LANGUAGE = "en"

export const languages = Object.keys(LANGUAGES)

export function texts(language) {
  return LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE]
}
