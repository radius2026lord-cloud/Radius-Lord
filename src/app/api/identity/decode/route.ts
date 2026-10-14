import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_INPUT_LENGTH = 30_000;
const MAX_OUTPUT_BYTES = 1_000_000;

function pythonCommand() {
  return process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
}

function runPython(input: string, health = false) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "tools", "identity_barcode_processor.py");
    const args = health ? [scriptPath, "--health"] : [scriptPath];
    const child = spawn(pythonCommand(), args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "ignore"] });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => child.kill(), 10_000);

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        fail(new Error("processor_output_too_large"));
        return;
      }
      output.push(chunk);
    });
    child.on("error", () => fail(new Error("python_unavailable")));
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timeout);
      if (code !== 0) {
        fail(new Error("processor_failed"));
        return;
      }
      try {
        const result = JSON.parse(Buffer.concat(output).toString("utf8")) as Record<string, unknown>;
        settled = true;
        resolve(result);
      } catch {
        fail(new Error("processor_invalid_response"));
      }
    });

    if (!health) child.stdin.end(input);
    else child.stdin.end();
  });
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "development_only" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await runPython("", true);
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "python_unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "development_only" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let text: unknown;
  try {
    const body = await request.json() as { text?: unknown };
    text = body.text;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: "text_too_long" }, { status: 413, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await runPython(JSON.stringify({ text }));
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: "python_processing_failed" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
