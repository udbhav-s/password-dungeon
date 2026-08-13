export interface ProgramWasmModule {
  // The complete WASM linear memory, including the C stack and dynamic heap.
  HEAPU8: Uint8Array;
  ccall: (
    name: string,
    returnType: string | null,
    argumentTypes: string[],
    argumentsList: unknown[],
    options?: { async?: boolean },
  ) => unknown;
}

type ProgramModuleOptions = {
  locateFile: (fileName: string) => string;
  noInitialRun: boolean;
  print: (text: string) => void;
  printErr: (text: string) => void;
  readLine: () => Promise<string>;
  onProgramMemoryChanged: () => void;
  onProgramSuccess: () => void;
};

type ProgramModuleFactory = (options: ProgramModuleOptions) => Promise<ProgramWasmModule>;
type ProgramFactoryName = "createRoom1Module" | "createRoom2Module" | "createBuffer1Module";

interface ProgramConfig {
  scriptPath: string;
  factoryName: ProgramFactoryName;
}

declare global {
  interface Window {
    createRoom1Module?: ProgramModuleFactory;
    createRoom2Module?: ProgramModuleFactory;
    createBuffer1Module?: ProgramModuleFactory;
  }
}

export interface ProgramManagerView {
  readonly bufferMemory: Uint8Array;
  readonly isLoading: boolean;
}

const wasmGluePromises: Partial<Record<ProgramFactoryName, Promise<ProgramModuleFactory>>> = {};

function moduleFactory(name: ProgramFactoryName): ProgramModuleFactory | undefined {
  if (name === "createRoom1Module") return window.createRoom1Module;
  if (name === "createRoom2Module") return window.createRoom2Module;
  return window.createBuffer1Module;
}

function loadWasmGlue(config: ProgramConfig): Promise<ProgramModuleFactory> {
  const existingFactory = moduleFactory(config.factoryName);
  if (existingFactory) return Promise.resolve(existingFactory);

  const existingPromise = wasmGluePromises[config.factoryName];
  if (existingPromise) return existingPromise;

  const promise = new Promise<ProgramModuleFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = config.scriptPath;
    script.async = true;
    script.onload = () => {
      const factory = moduleFactory(config.factoryName);
      if (factory) {
        resolve(factory);
      } else {
        reject(new Error(`The WASM loader did not expose ${config.factoryName}.`));
      }
    };
    script.onerror = () => reject(new Error(`Failed to load the WASM loader at ${config.scriptPath}.`));
    document.head.appendChild(script);
  });

  wasmGluePromises[config.factoryName] = promise;
  return promise;
}

export class ProgramManagerBase implements ProgramManagerView {
  readonly output: string[] = [];
  inputText = "";
  isLoading = false;
  isRunning = false;
  isSuccessful = false;

  private memory = new Uint8Array(0);
  private module?: ProgramWasmModule;
  private startPromise?: Promise<void>;
  private inputRequests: Array<(input: string) => void> = [];

  constructor(private readonly config: ProgramConfig) {}

  get bufferMemory(): Uint8Array {
    return this.memory;
  }

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
    const moduleFactory = await loadWasmGlue(this.config);
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
      await this.module.ccall("main", "number", [], [], { async: true });
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
    const start = Math.max(0, address);
    const end = Math.min(this.module.HEAPU8.length, start + Math.max(0, size));
    this.memory = this.module.HEAPU8.slice(start, end);
  }
}
