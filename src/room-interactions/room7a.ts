import { openDialog } from "../dialog";

const DIALOG_TEXT_SPEED = 28;
const REQUIRED_STREAK = 5;
const QUIZ_REQUIREMENT =
  "To obtain this item, you must correctly answer 5 questions in a row about little endian byte order!";

const INTRO_MESSAGES = [
  "Halt.",
  "You can read single bytes now. But numbers are rarely a single byte",
  "An int takes up 4 bytes of memory",
  "So which of the 4 bytes comes first?",
  "On this machine, the LITTLE end comes first. The smallest part of the number is stored at the lowest address",
  "Example: the number 258 is 0x00000102. In memory it sits as 02 01 00 00",
  "Read the bytes backwards and you get the number. Read them forwards and you get nonsense",
  QUIZ_REQUIREMENT,
  "Are you ready?",
] as const;

type Bytes = [number, number, number, number];

function randomByte(max = 255): number {
  return Math.floor(Math.random() * (max + 1));
}

// Keep the top byte small so every value stays inside a positive signed int.
function randomBytes(): Bytes {
  return [randomByte(), randomByte(), randomByte(), randomByte(63)];
}

function littleEndianValue(bytes: Bytes): number {
  return ((bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0);
}

function bigEndianValue(bytes: Bytes): number {
  return littleEndianValue([bytes[3], bytes[2], bytes[1], bytes[0]]);
}

function swappedPairs(bytes: Bytes): Bytes {
  return [bytes[1], bytes[0], bytes[3], bytes[2]];
}

function formatBytes(bytes: Bytes): string {
  return bytes.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

interface Question {
  prompt: string;
  correctAnswer: string;
  answers: string[];
}

// "These bytes are in memory, what number is it?"
function readQuestion(): Question {
  const bytes = randomBytes();
  const correctAnswer = String(littleEndianValue(bytes));
  const answers = new Set<string>([correctAnswer]);
  answers.add(String(bigEndianValue(bytes)));
  answers.add(String(littleEndianValue(swappedPairs(bytes))));
  while (answers.size < 4) answers.add(String(littleEndianValue(randomBytes())));

  return {
    prompt: `Memory reads ${formatBytes(bytes)}. Which int is stored there?`,
    correctAnswer,
    answers: [...answers],
  };
}

// "Here is a number, what does memory look like?"
function writeQuestion(): Question {
  const bytes = randomBytes();
  const value = littleEndianValue(bytes);
  const correctAnswer = formatBytes(bytes);
  const answers = new Set<string>([correctAnswer]);
  answers.add(formatBytes([bytes[3], bytes[2], bytes[1], bytes[0]]));
  answers.add(formatBytes(swappedPairs(bytes)));
  while (answers.size < 4) answers.add(formatBytes(randomBytes()));

  return {
    prompt: `The int ${value} was just stored. Which bytes are in memory?`,
    correctAnswer,
    answers: [...answers],
  };
}

export class Room7AInteraction {
  private introSeen = false;
  private itemNearby = false;
  private active = false;
  private completed = false;
  private correctStreak = 0;

  constructor(
    private readonly hasMemoryView: () => boolean,
    private readonly awardIntLens: () => void,
  ) {}

  updateItemProximity(isNearby: boolean): void {
    if (this.completed) return;
    if (isNearby && !this.itemNearby && !this.active) this.begin();
    this.itemNearby = isNearby;
  }

  private begin(): void {
    this.active = true;
    this.correctStreak = 0;
    const messages = this.introSeen ? [QUIZ_REQUIREMENT, "Are you ready?"] : INTRO_MESSAGES;
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
    const question = Math.random() < 0.5 ? readQuestion() : writeQuestion();

    openDialog([question.prompt], DIALOG_TEXT_SPEED, {
      choices: shuffled(question.answers).map((answer) => ({
        label: answer,
        onSelect: () => this.answer(answer === question.correctAnswer),
      })),
      onEscape: () => this.leaveQuiz(),
    });
  }

  private answer(correct: boolean): void {
    if (!correct) {
      this.correctStreak = 0;
      openDialog(["Wrong! Lowest byte first, remember"], DIALOG_TEXT_SPEED, {
        onComplete: () => this.askQuestion(),
        onEscape: () => this.leaveQuiz(),
      });
      return;
    }

    this.correctStreak += 1;
    if (this.correctStreak >= REQUIRED_STREAK) {
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
    this.awardIntLens();
    const messages = [
      "You read them backwards without flinching. Take this",
      "You got the INT LENS",
      "With this activated, you can hover over a line in the memory view to read each group of 4 bytes as a little endian integer",
      "No more counting hex digits backwards by hand!",
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
