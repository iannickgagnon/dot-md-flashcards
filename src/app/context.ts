import type { Flashcard } from "../parseFlashcards";

/** Per-card result in the current study pass (sidebar checkmarks and tallies). */
export type Outcome = "got" | "missed";

export type AppState = {
  cards: Flashcard[];
  deckPreamble: string | null;
  /** When set, Save writes here; from showOpenFilePicker, drop, or after showSaveFilePicker. */
  deckFileHandle: FileSystemFileHandle | null;
  /** Same directory as the linked deck for picker `startIn` (file or dir handle per FS Access). */
  deckFolderHint: FileSystemHandle | null;
  /** Index of the card currently shown in the main flashcard view. */
  index: number;
  got: number;
  missed: number;
  /** Display name of the deck (file name or tutorial label); enables Add when non-null even with zero cards. */
  fileLabel: string | null;
  isFlipped: boolean;
  outcomes: Map<number, Outcome>;
  /** True when every card has a got/missed mark (shows Restart). */
  sessionComplete: boolean;
  missedPanelCollapsed: boolean;
};

export const state: AppState = {
  cards: [],
  deckPreamble: null,
  deckFileHandle: null,
  deckFolderHint: null,
  index: 0,
  got: 0,
  missed: 0,
  fileLabel: null,
  isFlipped: false,
  outcomes: new Map(),
  sessionComplete: false,
  missedPanelCollapsed: false,
};

/** Whether `#edit-card-dialog` is editing the current card or creating a new one at end of deck. */
export const editCardDialog = {
  mode: "edit" as "edit" | "create",
};

/** Cached `#app` subtree queries; assigned once in `main.ts` after `innerHTML` is set. */
export type DomRefs = {
  fileInput: HTMLInputElement;
  btnOpen: HTMLButtonElement;
  btnNew: HTMLButtonElement;
  btnTutorial: HTMLButtonElement;
  btnTheme: HTMLButtonElement;
  sessionReadout: HTMLSpanElement;
  tallyGot: HTMLSpanElement;
  tallyMissed: HTMLSpanElement;
  fileMeta: HTMLParagraphElement;
  emptyHint: HTMLParagraphElement;
  flashcardWrap: HTMLDivElement;
  flipCard: HTMLDivElement;
  flashcardViewport: HTMLDivElement;
  flipPanel: HTMLDivElement;
  flashcardResizeHandle: HTMLDivElement;
  questionTitle: HTMLHeadingElement;
  answer: HTMLDivElement;
  btnPrev: HTMLButtonElement;
  btnNext: HTMLButtonElement;
  btnGot: HTMLButtonElement;
  btnMissed: HTMLButtonElement;
  btnRestart: HTMLButtonElement;
  dropZone: HTMLDivElement;
  missedPanel: HTMLElement;
  missedList: HTMLUListElement;
  btnMissedPanelToggle: HTMLButtonElement;
  missedPanelTitle: HTMLSpanElement;
  editDialog: HTMLDialogElement;
  editForm: HTMLFormElement;
  editTitle: HTMLInputElement;
  editBody: HTMLTextAreaElement;
  btnEditCard: HTMLButtonElement;
  btnAddCard: HTMLButtonElement;
  btnDeleteCard: HTMLButtonElement;
  editDialogTitle: HTMLHeadingElement;
  btnEditSave: HTMLButtonElement;
  btnEditCancel: HTMLButtonElement;
};

export let el: DomRefs;

export function registerDomRefs(refs: DomRefs): void {
  el = refs;
}
