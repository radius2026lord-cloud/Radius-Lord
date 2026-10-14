import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_INPUT_LENGTH = 30_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1_000_000;

function pythonCommand() {
  return process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
}

type ProcessorMode = "request" | "health" | "scanner-status" | "scanner-scan";

function runPython(input: string, mode: ProcessorMode = "request") {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "tools", "identity_barcode_processor.py");
    const modeArguments: Record<ProcessorMode, string[]> = {
      request: [],
      health: ["--health"],
      "scanner-status": ["--scanner-status"],
      "scanner-scan": ["--scanner-scan"],
    };
    const args = [scriptPath, ...modeArguments[mode]];
    const child = spawn(pythonCommand(), args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "ignore"] });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => child.kill(), mode === "scanner-scan" ? 70_000 : 30_000);

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

    if (mode === "request") child.stdin.end(input);
    else child.stdin.end();
  });
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "development_only" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await runPython("", "health");
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "python_unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "development_only" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let input: { action?: string; text?: string; images?: string[] };
  let scannerAction: "scanner-status" | "scanner-scan" | undefined;
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const text = form.get("text");
      const files = form.getAll("images").filter((entry): entry is File => entry instanceof File);
      if (files.length > 2) {
        return NextResponse.json({ error: "too_many_images" }, { status: 413, headers: NO_STORE_HEADERS });
      }

      let totalBytes = 0;
      const images: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json({ error: "image_required" }, { status: 400, headers: NO_STORE_HEADERS });
        }
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: "image_too_large" }, { status: 413, headers: NO_STORE_HEADERS });
        }
        totalBytes += file.size;
        if (totalBytes > MAX_IMAGE_BYTES * 2) {
          return NextResponse.json({ error: "images_too_large" }, { status: 413, headers: NO_STORE_HEADERS });
        }
        images.push(Buffer.from(await file.arrayBuffer()).toString("base64"));
      }

      if (typeof text === "string" && text.length > MAX_INPUT_LENGTH) {
        return NextResponse.json({ error: "text_too_long" }, { status: 413, headers: NO_STORE_HEADERS });
      }
      input = { text: typeof text === "string" ? text : "", images };
    } else {
      const body = await request.json() as { action?: unknown; text?: unknown };
      if (body.action === "scanner-status" || body.action === "scanner-scan") {
        scannerAction = body.action;
        input = {};
      } else {
        const textTooLong = typeof body.text === "string" && body.text.length > MAX_INPUT_LENGTH;
        if (typeof body.text !== "string" || textTooLong) {
          return NextResponse.json({ error: textTooLong ? "text_too_long" : "invalid_text" }, { status: textTooLong ? 413 : 400, headers: NO_STORE_HEADERS });
        }
        input = { text: body.text };
      }
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (scannerAction) {
    try {
      const result = await runPython("", scannerAction);
      return NextResponse.json(result, { status: result.ok === false ? 503 : 200, headers: NO_STORE_HEADERS });
    } catch {
      return NextResponse.json({ error: "scanner_processor_unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
    }
  }

  if (!input.images?.length && !input.text?.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await runPython(JSON.stringify(input));
    if (result.ok === false) {
      return NextResponse.json(result, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: "python_processing_failed" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
