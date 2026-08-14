const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");

const projectDirectory = path.resolve(__dirname, "..");
const programsDirectory = path.join(projectDirectory, "public", "programs");
const overflowInput = "AAAAAAAAAAAApass";

function loadFactory() {
  const source = fs.readFileSync(path.join(programsDirectory, "room10.js"), "utf8");
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
  vm.runInNewContext(source, sandbox, { filename: "room10.js" });
  assert.equal(typeof moduleShim.exports, "function", "createRoom10Module was not exported");
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
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": filePath.endsWith(".wasm") ? "application/wasm" : "text/javascript",
      });
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

async function main() {
  assert.ok(overflowInput.length > 8, "The test input must exceed inputPassword[8]");
  const { server, baseUrl } = await startProgramServer();
  try {
    const factory = loadFactory();
    const output = [];
    let successful = false;
    const module = await factory({
      locateFile: (fileName) => `${baseUrl}/programs/${fileName}`,
      noInitialRun: true,
      print: (text) => output.push(text),
      printErr: (text) => output.push(text),
      readLine: async () => overflowInput,
      onProgramMemoryChanged: () => {},
      onProgramSuccess: () => {
        successful = true;
      },
    });

    await module.ccall("main", "number", [], [], { async: true });
    const address = module.ccall("get_buffer_address", "number", [], []);
    const size = module.ccall("get_buffer_size", "number", [], []);
    const memory = module.HEAPU8.slice(address, address + size);

    assert.equal(size, 36, "UserData should occupy 36 bytes without struct packing");
    assert.equal(successful, true, "The overflow should trigger the success callback");
    assert.equal(
      Buffer.from(memory.slice(16, 28)).toString("ascii"),
      overflowInput.slice(0, 12),
      "The input should overflow inputPassword into the following integer",
    );
    assert.equal(
      Buffer.from(memory.slice(28, 33)).toString("ascii"),
      "pass\0",
      "The overflow should replace unmodifiable with a null-terminated pass string",
    );
    assert.ok(output.join("\n").includes("WHAT. How did you do this???"));

    console.log(
      `Room 10 overflow verified: ${overflowInput.length} bytes crossed the 8-byte buffer and changed unmodifiable from "nope" to "pass".`,
    );
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
