export interface L1WasmModule {
  HEAPU8: Uint8Array;
  ccall: (
    name: string,
    returnType: string | null,
    argumentTypes: string[],
    argumentsList: unknown[],
  ) => unknown;
}

type L1ModuleFactory = (options: {
  locateFile: (fileName: string) => string;
  noInitialRun: boolean;
  print: (text: string) => void;
  printErr: (text: string) => void;
  readLine: () => Promise<string>;
  onProgramMemoryChanged: () => void;
  onProgramSuccess: () => void;
}) => Promise<L1WasmModule>;

declare global {
  interface Window {
    createL1Module?: L1ModuleFactory;
  }
}

let wasmGluePromise: Promise<L1ModuleFactory> | undefined;

function loadWasmGlue(): Promise<L1ModuleFactory> {
  if (window.createL1Module) return Promise.resolve(window.createL1Module);
  if (wasmGluePromise) return wasmGluePromise;

  wasmGluePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/programs/l1.js";
    script.async = true;
    script.onload = () => {
      if (window.createL1Module) {
        resolve(window.createL1Module);
      } else {
        reject(new Error("The L1 WASM loader did not expose createL1Module."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load the L1 WASM loader."));
    document.head.appendChild(script);
  });

  return wasmGluePromise;
}

export class L1ProgramManager {
  readonly bufferMemory = new Uint8Array(10);
  readonly output: string[] = [];
  inputText = "";
  isLoading = false;
  isRunning = false;
  isSuccessful = false;

  private module?: L1WasmModule;
  private startPromise?: Promise<void>;
  private inputRequests: Array<(input: string) => void> = [];

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;

    this.isLoading = true;
    this.startPromise = this.loadAndRun();
    return this.startPromise;
  }

  submitInput(input: string): void {
    this.inputText = "";
    const request = this.inputRequests.shift();
    if (request) request(input);
  }

  appendInputCharacter(character: string): void {
    this.inputText += character;
  }

  removeInputCharacter(): void {
    this.inputText = this.inputText.slice(0, -1);
  }

  private async loadAndRun(): Promise<void> {
    const moduleFactory = await loadWasmGlue();
    this.module = await moduleFactory({
      locateFile: (fileName) => `/programs/${fileName}`,
      print: (text) => this.receiveOutput(text),
      printErr: (text) => this.receiveOutput(text),
      readLine: () => this.waitForInput(),
      onProgramMemoryChanged: () => this.syncProgramMemory(),
      onProgramSuccess: () => {
        this.isSuccessful = true;
      },
      noInitialRun: true,
    });

    this.isLoading = false;
    this.isRunning = true;
    this.syncProgramMemory();

    try {
      await this.module.ccall("main", "number", [], []);
    } finally {
      this.isRunning = false;
    }
  }

  private waitForInput(): Promise<string> {
    return new Promise((resolve) => {
      this.inputRequests.push(resolve);
    });
  }

  private receiveOutput(text: string): void {
    this.output.push(text);
  }

  private syncProgramMemory(): void {
    if (!this.module) return;

    const address = this.module.ccall("get_buffer_address", "number", [], []) as number;
    const size = this.module.ccall("get_buffer_size", "number", [], []) as number;
    this.bufferMemory.fill(0);
    this.bufferMemory.set(this.module.HEAPU8.slice(address, address + size));
  }
}
