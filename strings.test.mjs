import assert from "node:assert/strict"
import test from "node:test"
import { DEFAULT_LANGUAGE, LANGUAGES, languages, texts } from "./strings.js"

test("unknown or missing language falls back to English", () => {
  assert.equal(texts(undefined), LANGUAGES.en)
  assert.equal(texts("es"), LANGUAGES.en)
  assert.equal(texts("id"), LANGUAGES.id)
})

test("every language defines the same keys", () => {
  const expected = Object.keys(LANGUAGES[DEFAULT_LANGUAGE]).sort()
  for (const language of languages) {
    assert.deepEqual(Object.keys(LANGUAGES[language]).sort(), expected, language)
  }
})

test("no string is empty", () => {
  for (const language of languages) {
    for (const [key, value] of Object.entries(LANGUAGES[language])) {
      assert.equal(typeof value, "string", `${language}.${key}`)
      assert.ok(value.length > 0, `${language}.${key} is empty`)
    }
  }
})
