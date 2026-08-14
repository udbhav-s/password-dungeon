const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");

const projectDirectory = path.resolve(__dirname, "..");
const programsDirectory = path.join(projectDirectory, "public", "programs");

function loadFactory(fileName, factoryName) {
  const source = fs.readFileSync(path.join(programsDirectory, fileName), "utf8");
  const moduleShim = { exports: {} };
  const sandbox = {
    clearTimeout,
    console,
    exports: moduleShim.exports,
    fetch,
    module: moduleShim,
    setTimeout,
    TextDecoder,
    TextEncoder,
    URL,
    WebAssembly,
    window: {},
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(source, sandbox, { filename: fileName });
  assert.equal(typeof moduleShim.exports, "function", `${factoryName} was not exported`);
  return moduleShim.exports;
}

function startProgramServer() {
  const server = http.createServer((request, response) => {
    const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = requestPath.replace(/^\/programs\//, "");
    const filePath = path.join(programsDirectory, relativePath);

    if (!requestPath.startsWith("/programs/") || !filePath.startsWith(`${programsDirectory}${path.sep}`)) {
      response.writeHead(404);
      response.end();
      return;
    }

    const contentType = filePath.endsWith(".wasm") ? "application/wasm" : "text/javascript";
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "Content-Type": contentType });
      response.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function verifyProgram({ baseUrl, fileName, factoryName, input, expected }) {
  const factory = loadFactory(fileName, factoryName);
  const output = [];
  let memoryChanged = false;
  let successful = false;

  const module = await factory({
    locateFile: (programFileName) => `${baseUrl}/programs/${programFileName}`,
    noInitialRun: true,
    print: (text) => output.push(text),
    printErr: (text) => output.push(text),
    readLine: async () => input,
    onProgramMemoryChanged: () => {
      memoryChanged = true;
    },
    onProgramSuccess: () => {
      successful = true;
    },
  });

  await module.ccall("main", "number", [], [], { async: true });

  assert.equal(memoryChanged, true, `${factoryName} did not report a memory change`);
  assert.equal(successful, expected.successful, `${factoryName} success state was incorrect`);
  const outputText = output.join("\n");
  for (const expectedLine of expected.output) {
    assert.ok(outputText.includes(expectedLine), `${factoryName} output did not contain ${expectedLine}`);
  }

  const address = module.ccall("get_buffer_address", "number", [], []);
  const size = module.ccall("get_buffer_size", "number", [], []);
  const buffer = module.HEAPU8.slice(address, address + size);
  assert.equal(buffer.length, expected.bufferSize, `${factoryName} exposed an unexpected buffer size`);
  if (expected.state) {
    const state = module.ccall(expected.state.name, "number", [], []);
    assert.equal(state, expected.state.value, `${factoryName} exposed an unexpected state value`);
  }

  console.log(`${factoryName}: loaded, ran main, received input, and synchronized ${buffer.length} bytes`);
}

async function main() {
  const { server, baseUrl } = await startProgramServer();
  try {
    await verifyProgram({
      baseUrl,
      fileName: "room1.js",
      factoryName: "createRoom1Module",
      input: "password",
      expected: { bufferSize: 10, output: ["Enter the password", "Success!"], successful: true },
    });
    await verifyProgram({
      baseUrl,
      fileName: "buffer1.js",
      factoryName: "createBuffer1Module",
      input: "AAAAAAAA",
      expected: { bufferSize: 12, output: ["Enter the password", "Success!"], successful: true },
    });
    await verifyProgram({
      baseUrl,
      fileName: "room2.js",
      factoryName: "createRoom2Module",
      input: "supersecret1923",
      expected: { bufferSize: 20, output: ["Enter password", "success!"], successful: true },
    });
    await verifyProgram({
      baseUrl,
      fileName: "room3.js",
      factoryName: "createRoom3Module",
      input: "10",
      expected: {
        bufferSize: 4,
        output: ["Hi...", "Adjusted ball size"],
        successful: true,
        state: { name: "get_ball_size", value: 10 },
      },
    });
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
