import "@fontsource/geist/latin-300.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist-mono/latin-400.css";
import "./styles.css";
import { parseFlashcards, type Flashcard } from "./parseFlashcards";
import { renderAnswerHtml, renderTitleHtml } from "./renderMarkdown";

const THEME_KEY = "markdown-flashcards-theme";

function getTheme(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

type Outcome = "got" | "missed";

type AppState = {
  cards: Flashcard[];
  index: number;
  got: number;
  missed: number;
  fileLabel: string | null;
  isFlipped: boolean;
  outcomes: Map<number, Outcome>;
};

const state: AppState = {
  cards: [],
  index: 0,
  got: 0,
  missed: 0,
  fileLabel: null,
  isFlipped: false,
  outcomes: new Map(),
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <header class="app-header">
    <h1 class="app-title">Markdown flashcards</h1>
    <div class="header-tools">
      <button type="button" class="btn-theme" id="btn-theme">Light</button>
      <button type="button" class="btn-secondary" id="btn-open" aria-controls="file-input">
        Open markdown file
      </button>
      <input class="hidden-input" id="file-input" type="file" accept=".md,.markdown,text/markdown,text/x-markdown" />
      <button type="button" class="btn-secondary" id="btn-sample">Load sample deck</button>
      <span class="mono-label" id="session-readout" aria-live="polite">Card 0 / 0</span>
      <span class="tally" id="tally" aria-live="polite">
        Got <strong id="tally-got">0</strong> · <span class="tally-missed-dot" aria-hidden="true"></span>Missed <strong id="tally-missed">0</strong>
      </span>
    </div>
    <p class="file-meta" id="file-meta"></p>
  </header>
  <main>
    <div class="drop-zone" id="drop-zone" tabindex="-1">
      <p class="empty-hint" id="empty-hint">Drop a .md file here, use Open markdown file, or load the sample deck.</p>
      <div class="flashcard-wrap" id="flashcard-wrap" hidden>
        <article class="flashcard" aria-label="Flashcard deck">
          <button type="button" class="nav-strip nav-strip--prev" id="btn-prev" aria-label="Previous flashcard">←</button>
          <div
            class="flashcard-flip"
            id="flashcard-flip"
            tabindex="0"
            role="button"
            aria-pressed="false"
            aria-label="Showing question. Click or press Enter to reveal the answer."
          >
            <div class="flashcard-flip__panel" id="flip-panel">
              <div class="flashcard-face flashcard-face--front">
                <h2 id="question-title"></h2>
                <p class="flashcard-hint">Click to reveal answer</p>
              </div>
              <div class="flashcard-face flashcard-face--back">
                <div class="answer prose" id="answer"></div>
              </div>
            </div>
          </div>
          <button type="button" class="nav-strip nav-strip--next" id="btn-next" aria-label="Next flashcard">→</button>
        </article>
      </div>
      <div class="actions">
        <button type="button" class="btn-primary" id="btn-got" disabled>GOT IT</button>
        <button type="button" class="btn-outline" id="btn-missed" disabled>MISSED IT</button>
      </div>
    </div>
  </main>
`;

const el = {
  fileInput: app.querySelector<HTMLInputElement>("#file-input")!,
  btnOpen: app.querySelector<HTMLButtonElement>("#btn-open")!,
  btnSample: app.querySelector<HTMLButtonElement>("#btn-sample")!,
  btnTheme: app.querySelector<HTMLButtonElement>("#btn-theme")!,
  sessionReadout: app.querySelector<HTMLSpanElement>("#session-readout")!,
  tallyGot: app.querySelector<HTMLSpanElement>("#tally-got")!,
  tallyMissed: app.querySelector<HTMLSpanElement>("#tally-missed")!,
  fileMeta: app.querySelector<HTMLParagraphElement>("#file-meta")!,
  emptyHint: app.querySelector<HTMLParagraphElement>("#empty-hint")!,
  flashcardWrap: app.querySelector<HTMLDivElement>("#flashcard-wrap")!,
  flipCard: app.querySelector<HTMLDivElement>("#flashcard-flip")!,
  flipPanel: app.querySelector<HTMLDivElement>("#flip-panel")!,
  questionTitle: app.querySelector<HTMLHeadingElement>("#question-title")!,
  answer: app.querySelector<HTMLDivElement>("#answer")!,
  btnPrev: app.querySelector<HTMLButtonElement>("#btn-prev")!,
  btnNext: app.querySelector<HTMLButtonElement>("#btn-next")!,
  btnGot: app.querySelector<HTMLButtonElement>("#btn-got")!,
  btnMissed: app.querySelector<HTMLButtonElement>("#btn-missed")!,
  dropZone: app.querySelector<HTMLDivElement>("#drop-zone")!,
};

function syncThemeButton(): void {
  const t = getTheme();
  el.btnTheme.textContent = t === "dark" ? "Light" : "Dark";
  el.btnTheme.setAttribute(
    "aria-label",
    t === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
}

function setTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  syncThemeButton();
}

el.btnTheme.addEventListener("click", () => {
  setTheme(getTheme() === "dark" ? "light" : "dark");
});

function toggleFlip(): void {
  const n = state.cards.length;
  if (n === 0) return;
  state.isFlipped = !state.isFlipped;
  render();
}

function flashcardFlipClick(e: MouseEvent): void {
  const t = e.target as Element;
  if (t.closest("a") || t.closest("button")) return;
  toggleFlip();
}

function flashcardFlipKeydown(e: KeyboardEvent): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  const t = e.target as Element;
  if (t.closest("a")) return;
  e.preventDefault();
  toggleFlip();
}

el.flipCard.addEventListener("click", flashcardFlipClick);
el.flipCard.addEventListener("keydown", flashcardFlipKeydown);

function loadDeck(text: string, label: string): void {
  const { cards } = parseFlashcards(text);
  state.cards = cards;
  state.index = 0;
  state.got = 0;
  state.missed = 0;
  state.fileLabel = label;
  state.isFlipped = false;
  state.outcomes = new Map();
  render();
}

async function loadSample(): Promise<void> {
  const res = await fetch("/sample-deck.md");
  if (!res.ok) throw new Error("Could not load sample deck");
  const text = await res.text();
  loadDeck(text, "sample-deck.md");
}

function render(): void {
  const n = state.cards.length;
  const hasCards = n > 0;

  el.emptyHint.hidden = hasCards;
  el.flashcardWrap.hidden = !hasCards;

  el.fileMeta.textContent = state.fileLabel
    ? `${state.fileLabel} · ${n} card${n === 1 ? "" : "s"}`
    : "";

  el.sessionReadout.textContent = hasCards ? `Card ${state.index + 1} / ${n}` : "Card 0 / 0";
  el.tallyGot.textContent = String(state.got);
  el.tallyMissed.textContent = String(state.missed);

  if (!hasCards) {
    el.questionTitle.innerHTML = "";
    el.answer.innerHTML = "";
    el.flipPanel.classList.remove("is-back");
    el.flipCard.setAttribute("aria-pressed", "false");
    el.flipCard.setAttribute(
      "aria-label",
      "No cards loaded. Open a markdown deck to study.",
    );
    el.flipCard.setAttribute("tabindex", "-1");
    el.btnGot.disabled = true;
    el.btnMissed.disabled = true;
    el.btnPrev.disabled = true;
    el.btnNext.disabled = true;
    return;
  }

  el.flipCard.setAttribute("tabindex", "0");

  const alreadyMarked = state.outcomes.has(state.index);
  el.btnGot.disabled = alreadyMarked;
  el.btnMissed.disabled = alreadyMarked;

  el.btnPrev.disabled = false;
  el.btnNext.disabled = false;

  const card = state.cards[state.index]!;
  el.questionTitle.innerHTML = renderTitleHtml(card.title);
  el.answer.innerHTML = renderAnswerHtml(card.bodyMd);

  el.flipPanel.classList.toggle("is-back", state.isFlipped);
  el.flipCard.setAttribute("aria-pressed", state.isFlipped ? "true" : "false");
  el.flipCard.setAttribute(
    "aria-label",
    state.isFlipped
      ? "Showing answer. Click or press Enter to show the question."
      : "Showing question. Click or press Enter to reveal the answer.",
  );
}

function go(delta: number): void {
  const n = state.cards.length;
  if (n === 0) return;
  state.index = (state.index + delta + n) % n;
  state.isFlipped = false;
  render();
}

function markOutcome(kind: Outcome): void {
  const n = state.cards.length;
  if (n === 0) return;
  const i = state.index;
  if (state.outcomes.has(i)) return;

  state.outcomes.set(i, kind);
  if (kind === "got") state.got += 1;
  else state.missed += 1;

  state.index = (state.index + 1) % n;
  state.isFlipped = false;
  render();
}

el.btnOpen.addEventListener("click", () => el.fileInput.click());

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files?.[0];
  el.fileInput.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadDeck(text, file.name);
  };
  reader.readAsText(file);
});

el.btnSample.addEventListener("click", () => {
  void loadSample().catch(() => {
    el.fileMeta.textContent = "Could not load sample deck.";
  });
});

el.btnPrev.addEventListener("click", (e) => {
  e.stopPropagation();
  go(-1);
});
el.btnNext.addEventListener("click", (e) => {
  e.stopPropagation();
  go(1);
});

el.btnGot.addEventListener("click", () => markOutcome("got"));
el.btnMissed.addEventListener("click", () => markOutcome("missed"));

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    go(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    go(1);
  }
});

function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
  el.dropZone.addEventListener(evt, preventDefaults, false);
});

el.dropZone.addEventListener("dragenter", () => {
  el.dropZone.classList.add("is-dragover");
});
el.dropZone.addEventListener("dragleave", (e) => {
  const related = e.relatedTarget as Node | null;
  if (!related || !el.dropZone.contains(related)) {
    el.dropZone.classList.remove("is-dragover");
  }
});
el.dropZone.addEventListener("drop", (e) => {
  el.dropZone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown") && file.type !== "text/markdown") {
    el.fileMeta.textContent = "Please drop a Markdown (.md) file.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadDeck(text, file.name);
  };
  reader.readAsText(file);
});

syncThemeButton();
render();
