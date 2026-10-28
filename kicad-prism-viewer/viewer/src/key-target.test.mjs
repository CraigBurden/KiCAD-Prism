import assert from "node:assert/strict";
import test from "node:test";

import { hasCommandModifier, isTypingTarget } from "./key-target.js";

const key = (target, extra = {}) => ({ target, composedPath: () => [target], ...extra });

test("keys typed into text fields, text areas, selects and editable elements are not the viewer's", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "textarea"]) {
    assert.equal(isTypingTarget(key({ tagName })), true, tagName);
  }
  assert.equal(isTypingTarget(key({ tagName: "DIV", isContentEditable: true })), true);
});

test("keys on the canvas or the page body stay with the viewer", () => {
  assert.equal(isTypingTarget(key({ tagName: "CANVAS" })), false);
  assert.equal(isTypingTarget(key({ tagName: "BODY", isContentEditable: false })), false);
  assert.equal(isTypingTarget({ target: null }), false);
});

test("the typed-into element inside a shadow root wins over the retargeted host", () => {
  const event = { target: { tagName: "PRISM-SEMANTIC-VIEWER" }, composedPath: () => [{ tagName: "TEXTAREA" }] };
  assert.equal(isTypingTarget(event), true);
});

test("Cmd and Ctrl combinations are left to the browser and OS", () => {
  assert.equal(hasCommandModifier({ key: " ", metaKey: true }), true);
  assert.equal(hasCommandModifier({ key: "r", ctrlKey: true }), true);
  // Alt stays with the viewer: Alt+ArrowUp opens the parent schematic sheet.
  assert.equal(hasCommandModifier({ key: "ArrowUp", altKey: true }), false);
  assert.equal(hasCommandModifier({ key: " ", shiftKey: true }), false);
  assert.equal(hasCommandModifier({ key: " " }), false);
});
