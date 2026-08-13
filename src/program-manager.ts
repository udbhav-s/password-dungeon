export interface L1WasmModule {
  HEAPU8: Uint8Array;
  ccall: (
    name: string,
    returnType: string | null,
    argumentTypes: string[],
    argumentsList: unknown[],
  ) => unknown;
}

export interface L1WasmExports {
  memory: WebAssembly.Memory;
  __indirect_function_table: WebAssembly.Table;
  emscripten_stack_get_current: () => number;
  get_buffer_address: () => number;
  get_buffer_size: () => number;
}

type L1ModuleFactory = (options: {
  locateFile: (fileName: string) => string;
  noInitialRun: boolean;
  print: (text: string) => void;
  printErr: (text: string) => void;
  readLine: () => Promise<string>;
  onProgramMemoryChanged: () => void;
  onProgramSuccess: () => void;
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ) => object;
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
  readonly programMemory = new Uint8Array(10);
  readonly output: string[] = [];
  inputText = "";
  isLoading = false;
  isRunning = false;
  isSuccessful = false;

  private module?: L1WasmModule;
  private startPromise?: Promise<void>;
  private inputRequests: Array<(input: string) => void> = [];
  private wasmExports?: L1WasmExports;
  private cachedFunctionTableEntries?: Array<{ index: number; name: string }>;

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
      instantiateWasm: (
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
      ) => {
        void (async () => {
          const url = "/programs/l1.wasm";
          let result: WebAssembly.WebAssemblyInstantiatedSource;
          try {
            result = await WebAssembly.instantiateStreaming(fetch(url), imports);
          } catch {
            // instantiateStreaming requires an application/wasm MIME type; fall back if the host doesn't send one.
            result = await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports);
          }
          this.wasmExports = result.instance.exports as unknown as L1WasmExports;
          successCallback(result.instance, result.module);
        })();
        return {};
      },
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
    this.programMemory.set(this.module.HEAPU8.slice(address, address + size));
  }

  get memoryBytes(): Uint8Array | undefined {
    // emscripten_resize_heap detaches and replaces the underlying buffer, so a
    // cached view goes stale/zero-length. Always construct a fresh view.
    return this.wasmExports ? new Uint8Array(this.wasmExports.memory.buffer) : undefined;
  }

  get bufferAddress(): number {
    return this.wasmExports?.get_buffer_address() ?? 0;
  }

  get bufferSize(): number {
    return this.wasmExports?.get_buffer_size() ?? 0;
  }

  get stackPointer(): number {
    return this.wasmExports?.emscripten_stack_get_current() ?? 0;
  }

  functionTableEntries(): Array<{ index: number; name: string }> {
    if (!this.wasmExports) return [];
    if (this.cachedFunctionTableEntries) return this.cachedFunctionTableEntries;

    const table = this.wasmExports.__indirect_function_table;
    const entries: Array<{ index: number; name: string }> = [];
    for (let index = 0; index < table.length; index++) {
      let fn: unknown;
      try {
        fn = table.get(index);
      } catch {
        continue;
      }
      if (!fn) continue;
      const name = typeof (fn as { name?: string }).name === "string" && (fn as { name: string }).name.length > 0
        ? (fn as { name: string }).name
        : `fn#${index}`;
      entries.push({ index, name });
    }

    this.cachedFunctionTableEntries = entries;
    return entries;
  }
}
