import { EMPTY_HINT_LINKED_NO_CARDS, EMPTY_HINT_NO_DECK } from "../app/deckCopy";
import { el, state } from "../app/context";
import { renderAnswerHtml, renderTitleHtml } from "../renderMarkdown";

/** Truncate card title for the sidebar list (accessibility / dense layout). */
function titlePlainForList(raw: string): string {
  const collapsedWhitespace = raw.replace(/\s+/g, " ").trim();
  return collapsedWhitespace.length > 100 ? `${collapsedWhitespace.slice(0, 97)}…` : collapsedWhitespace;
}

/**
 * Add is allowed when the user has a “session” worth extending: an on-disk label (new/open deck)
 * or at least one card. `fileLabel` alone covers preamble-only files and save-first new decks.
 */
function canAddCard(): boolean {
  return state.fileLabel !== null || state.cards.length > 0;
}

let resizeHandleFlipHideGeneration = 0;

/**
 * Hides the resize grip during the flip animation: it lives outside the 3D panel in the DOM but
 * visually clashes with the rotation. For `prefers-reduced-motion`, we key off face `opacity` instead
 * of panel `transform`. Generation counter plus timeout avoids a stuck hidden handle if `transitionend`
 * never fires (rapid flips or browser quirks).
 */
function beginResizeHandleFlipHide(): void {
  const flipGeneration = ++resizeHandleFlipHideGeneration;
  el.flashcardResizeHandle.classList.add("flashcard-resize-handle--flip-active");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fallbackMs = reducedMotion ? 250 : 720;
  let fallbackTimeoutId: number | undefined;

  const finish = () => {
    if (fallbackTimeoutId !== undefined) {
      window.clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = undefined;
    }
    el.flipPanel.removeEventListener("transitionend", onTransitionEnd);
    if (flipGeneration !== resizeHandleFlipHideGeneration) return;
    el.flashcardResizeHandle.classList.remove("flashcard-resize-handle--flip-active");
  };

  const onTransitionEnd = (ev: TransitionEvent) => {
    const target = ev.target as Node;
    if (!el.flipPanel.contains(target)) return;
    if (reducedMotion) {
      if (ev.propertyName !== "opacity") return;
    } else if (ev.target !== el.flipPanel || ev.propertyName !== "transform") {
      return;
    }
    finish();
  };

  el.flipPanel.addEventListener("transitionend", onTransitionEnd);
  fallbackTimeoutId = window.setTimeout(finish, fallbackMs);
}

/** Rebuilds the FLASHCARDS sidebar list and collapsed state. */
export function renderDeckPanel(): void {
  const cardCount = state.cards.length;
  el.missedPanel.hidden = cardCount === 0;

  if (cardCount === 0) {
    el.missedList.innerHTML = "";
    return;
  }

  el.missedPanelTitle.textContent = `Flashcards (${cardCount})`;
  el.missedPanel.classList.toggle("missed-panel--collapsed", state.missedPanelCollapsed);
  el.btnMissedPanelToggle.textContent = state.missedPanelCollapsed ? "Show" : "Hide";
  el.btnMissedPanelToggle.setAttribute(
    "aria-expanded",
    state.missedPanelCollapsed ? "false" : "true",
  );

  el.missedList.innerHTML = "";
  for (let index = 0; index < cardCount; index++) {
    const card = state.cards[index]!;
    const li = document.createElement("li");
    li.className = "missed-panel__li";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "missed-panel__item";
    if (index === state.index) {
      btn.classList.add("missed-panel__item--active");
      btn.setAttribute("aria-current", "true");
    }
    btn.dataset.index = String(index);
    const plain = titlePlainForList(card.title);
    btn.setAttribute("aria-label", `Go to card ${index + 1}: ${plain}`);

    const status = document.createElement("span");
    status.className = "missed-panel__status";
    const outcome = state.outcomes.get(index);
    if (outcome === "got") {
      status.classList.add("missed-panel__status--got");
      const icon = document.createElement("span");
      icon.className = "missed-panel__status-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      status.appendChild(icon);
    } else if (outcome === "missed") {
      status.classList.add("missed-panel__status--missed");
      const icon = document.createElement("span");
      icon.className = "missed-panel__status-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✗";
      status.appendChild(icon);
    }

    const labelEl = document.createElement("span");
    labelEl.className = "missed-panel__label";
    labelEl.textContent = plain;

    btn.appendChild(status);
    btn.appendChild(labelEl);
    li.appendChild(btn);
    el.missedList.appendChild(li);
  }
}

/** User-chosen flashcard area height for this tab session only (no localStorage). */
let flashcardViewportHeightPx: number | null = null;

const FLASHCARD_VIEWPORT_MIN_PX = 220;

function flashcardViewportMaxPx(): number {
  return Math.max(FLASHCARD_VIEWPORT_MIN_PX, Math.floor(window.innerHeight * 0.92));
}

function clampFlashcardViewportHeight(heightPx: number): number {
  return Math.min(flashcardViewportMaxPx(), Math.max(FLASHCARD_VIEWPORT_MIN_PX, heightPx));
}

/** Syncs flashcard column height from tab-session preference or CSS default. */
function syncFlashcardViewportHeight(): void {
  const viewport = el.flashcardViewport;
  if (flashcardViewportHeightPx === null) {
    viewport.style.removeProperty("height");
  } else {
    flashcardViewportHeightPx = clampFlashcardViewportHeight(flashcardViewportHeightPx);
    viewport.style.height = `${flashcardViewportHeightPx}px`;
  }
}

/** Applies session `flashcardViewportHeightPx` to the DOM (no full `render`). */
export function applyFlashcardViewportHeightFromSession(): void {
  syncFlashcardViewportHeight();
}

/**
 * Syncs the DOM to `state`: header readouts, sidebar, flashcard faces, button disabled states,
 * and empty-hint copy when a file is linked but has no `##` cards yet.
 */
export function render(): void {
  const cardCount = state.cards.length;
  const hasCards = cardCount > 0;
  const canAdd = canAddCard();

  el.emptyHint.hidden = hasCards;
  el.flashcardWrap.hidden = !hasCards;
  // Distinguish “no file” from “file open, build prompts” so users aren’t told only to drop/Open.
  el.emptyHint.textContent =
    !hasCards && state.fileLabel !== null ? EMPTY_HINT_LINKED_NO_CARDS : EMPTY_HINT_NO_DECK;

  el.fileMeta.textContent = state.fileLabel
    ? `${state.fileLabel} · ${cardCount} card${cardCount === 1 ? "" : "s"}`
    : "";

  el.sessionReadout.textContent = hasCards
    ? `Card ${state.index + 1} / ${cardCount}`
    : "Card 0 / 0";
  el.tallyGot.textContent = String(state.got);
  el.tallyMissed.textContent = String(state.missed);

  el.btnRestart.hidden = !state.sessionComplete;

  renderDeckPanel();

  if (!hasCards) {
    const wasShowingAnswerWithNoCards = el.flipPanel.classList.contains("is-back");
    el.questionTitle.innerHTML = "";
    el.answer.innerHTML = "";
    el.flipPanel.classList.remove("is-back");
    if (wasShowingAnswerWithNoCards) beginResizeHandleFlipHide();
    el.flipCard.setAttribute("aria-pressed", "false");
    el.flipCard.setAttribute(
      "aria-label",
      state.fileLabel
        ? "No flashcards in this deck yet. Use Add to create a card."
        : "No cards loaded. Open a markdown deck to study.",
    );
    el.flipCard.setAttribute("tabindex", "-1");
    el.btnGot.disabled = true;
    el.btnMissed.disabled = true;
    el.btnGot.hidden = true;
    el.btnMissed.hidden = true;
    el.btnGot.classList.remove("btn-primary");
    el.btnGot.classList.add("btn-outline");
    el.btnMissed.classList.remove("btn-primary");
    el.btnMissed.classList.add("btn-outline");
    el.btnPrev.disabled = true;
    el.btnNext.disabled = true;
    el.btnEditCard.disabled = true;
    el.btnAddCard.disabled = !canAdd;
    el.btnDeleteCard.disabled = true;
    syncFlashcardViewportHeight();
    return;
  }

  el.flipCard.setAttribute("tabindex", "0");

  el.btnGot.disabled = false;
  el.btnGot.hidden = false;
  el.btnMissed.disabled = false;
  el.btnMissed.hidden = false;

  el.btnEditCard.disabled = false;
  el.btnAddCard.disabled = !canAdd;
  el.btnDeleteCard.disabled = false;

  el.btnPrev.disabled = state.index <= 0;
  el.btnNext.disabled = state.index >= cardCount - 1;

  const outcomeForCard = state.outcomes.get(state.index);
  el.btnGot.classList.toggle("btn-primary", outcomeForCard === "got");
  el.btnGot.classList.toggle("btn-outline", outcomeForCard !== "got");
  el.btnMissed.classList.toggle("btn-primary", outcomeForCard === "missed");
  el.btnMissed.classList.toggle("btn-outline", outcomeForCard !== "missed");

  const card = state.cards[state.index]!;
  el.questionTitle.innerHTML = renderTitleHtml(card.title);
  el.answer.innerHTML = renderAnswerHtml(card.bodyMd);

  const wasBackFace = el.flipPanel.classList.contains("is-back");
  const showBackFace = state.isFlipped;
  el.flipPanel.classList.toggle("is-back", showBackFace);
  if (wasBackFace !== showBackFace) beginResizeHandleFlipHide();

  el.flipCard.setAttribute("aria-pressed", state.isFlipped ? "true" : "false");
  el.flipCard.setAttribute(
    "aria-label",
    state.isFlipped
      ? "Showing answer. Click or press Enter to show the question. Press E to edit this card."
      : "Showing question. Click or press Enter to reveal the answer. Press E to edit this card.",
  );

  syncFlashcardViewportHeight();
}

export function getFlashcardViewportHeightPx(): number | null {
  return flashcardViewportHeightPx;
}

export function setFlashcardViewportHeightPx(next: number | null): void {
  flashcardViewportHeightPx = next;
}

export function clampFlashcardViewportHeightForWindow(heightPx: number): number {
  return clampFlashcardViewportHeight(heightPx);
}

export function flashcardViewportMaxPxForWindow(): number {
  return flashcardViewportMaxPx();
}

export const FLASHCARD_VIEWPORT_MIN = FLASHCARD_VIEWPORT_MIN_PX;
