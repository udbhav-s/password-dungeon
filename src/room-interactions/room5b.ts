import { openDialog } from "../dialog";

const DIALOG_TEXT_SPEED = 28;
const QUIZ_CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const QUIZ_REQUIREMENT =
  "To obtain this item, you must correctly answer 5 questions in a row about which hex bytes represent each character!";

const INTRO_MESSAGES = [
  "Not so fast!",
  "To prove you're worthy of using this special item, you must pass through a series of trials",
  "Do you know how programs store variables in memory?",
  "They are stored as bytes",
  "For example, char* strings are stored as ASCII, where each character is a byte",
  "There are many ways to represent a byte. One way is in hexadecimal",
  "Example: The character 'A' is the byte 65. In hex, this 0x41",
  "Similarly, 'B' is 66, which is 0x42",
  QUIZ_REQUIREMENT,
  "Are you ready?",
] as const;

function randomCharacter(): string {
  return QUIZ_CHARACTERS[Math.floor(Math.random() * QUIZ_CHARACTERS.length)];
}

function hexadecimal(character: string): string {
  return `0x${character.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()}`;
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export class Room5BInteraction {
  private introSeen = false;
  private itemNearby = false;
  private active = false;
  private completed = false;
  private correctStreak = 0;

  constructor(
    private readonly hasMemoryView: () => boolean,
    private readonly awardAsciiLens: () => void,
  ) {}

  updateItemProximity(isNearby: boolean): void {
    if (this.completed) return;
    if (isNearby && !this.itemNearby && !this.active) this.begin();
    this.itemNearby = isNearby;
  }

  private begin(): void {
    this.active = true;
    this.correctStreak = 0;
    const messages = this.introSeen
      ? [QUIZ_REQUIREMENT, "Are you ready?"]
      : INTRO_MESSAGES;
    this.introSeen = true;
    openDialog(messages, DIALOG_TEXT_SPEED, {
      choices: [
        { label: "yes", onSelect: () => this.askQuestion() },
        { label: "no", onSelect: () => this.leaveQuiz() },
      ],
      onEscape: () => this.leaveQuiz(),
    });
  }

  private askQuestion(): void {
    const character = randomCharacter();
    const correctAnswer = hexadecimal(character);
    const answers = new Set<string>([correctAnswer]);
    while (answers.size < 4) answers.add(hexadecimal(randomCharacter()));

    openDialog([`Which hex byte represents '${character}'?`], DIALOG_TEXT_SPEED, {
      choices: shuffled([...answers]).map((answer) => ({
        label: answer,
        onSelect: () => this.answer(answer === correctAnswer),
      })),
      onEscape: () => this.leaveQuiz(),
    });
  }

  private answer(correct: boolean): void {
    if (!correct) {
      this.correctStreak = 0;
      openDialog(["Wrong!"], DIALOG_TEXT_SPEED, {
        onComplete: () => this.askQuestion(),
        onEscape: () => this.leaveQuiz(),
      });
      return;
    }

    this.correctStreak += 1;
    if (this.correctStreak >= 5) {
      this.completeQuiz();
      return;
    }

    openDialog(["Correct!"], DIALOG_TEXT_SPEED, {
      onComplete: () => this.askQuestion(),
      onEscape: () => this.leaveQuiz(),
    });
  }

  private completeQuiz(): void {
    this.completed = true;
    this.active = false;
    this.awardAsciiLens();
    const messages = [
      "Wow, you are good! Take this item",
      "You got the ASCII LENS",
      "With this activated, you can hover over a line in the memory view to see the bytes as ASCII characters instead of hexadecimal",
      "Useful for quickly reading strings in memory!",
    ];
    if (!this.hasMemoryView()) {
      messages.push(
        "What's that? You don't know what memory view is?",
        "No worries, keep exploring..",
      );
    }
    openDialog(messages);
  }

  private leaveQuiz(): void {
    this.active = false;
    this.correctStreak = 0;
  }
}
