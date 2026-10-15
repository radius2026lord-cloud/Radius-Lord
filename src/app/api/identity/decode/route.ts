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

function runPython(input: string, mode: ProcessorMode = "request", signal?: AbortSignal) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("request_aborted"));
      return;
    }
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
      signal?.removeEventListener("abort", abortChild);
      reject(error);
    };
    const abortChild = () => {
      child.kill();
      fail(new Error("request_aborted"));
    };
    signal?.addEventListener("abort", abortChild, { once: true });

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
      signal?.removeEventListener("abort", abortChild);
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

function streamScannerScan(signal?: AbortSignal) {
  const encoder = new TextEncoder();
  let child: ReturnType<typeof spawn> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let outputBytes = 0;
  let lineBuffer = "";
  let settled = false;
  let abortHandler: (() => void) | undefined;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (settled) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const finish = (event?: Record<string, unknown>) => {
        if (settled) return;
        if (event) send(event);
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (abortHandler) signal?.removeEventListener("abort", abortHandler);
        try { controller.close(); } catch { /* stream already canceled */ }
      };
      const fail = (error: string) => finish({ type: "result", result: { ok: false, error } });
      abortHandler = () => {
        child?.kill();
        finish({ type: "result", result: { ok: false, error: "request_aborted" } });
      };
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          if (event.type === "progress") send(event);
          else finish({ type: "result", result: event });
        } catch {
          fail("processor_invalid_response");
        }
      };

      if (signal?.aborted) {
        fail("request_aborted");
        return;
      }

      const scriptPath = path.join(process.cwd(), "tools", "identity_barcode_processor.py");
      child = spawn(pythonCommand(), [scriptPath, "--scanner-scan"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "ignore"] });
      const scannerProcess = child;
      timeout = setTimeout(() => {
        child?.kill();
        fail("scanner_read_timeout");
      }, 70_000);
      if (abortHandler) signal?.addEventListener("abort", abortHandler, { once: true });

      scannerProcess.stdout?.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > MAX_OUTPUT_BYTES) {
          child?.kill();
          fail("processor_output_too_large");
          return;
        }
        lineBuffer += chunk.toString("utf8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";
        lines.forEach(handleLine);
      });
      scannerProcess.on("error", () => fail("python_unavailable"));
      scannerProcess.on("close", (code) => {
        if (settled) return;
        if (lineBuffer.trim()) handleLine(lineBuffer);
        if (!settled) fail(code === 0 ? "processor_invalid_response" : "processor_failed");
      });
      scannerProcess.stdin?.end();
    },
    cancel() {
      if (timeout) clearTimeout(timeout);
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
      child?.kill();
      settled = true;
    },
  });

  return new Response(body, { headers: { ...NO_STORE_HEADERS, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
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
    if (scannerAction === "scanner-scan") return streamScannerScan(request.signal);
    try {
      const result = await runPython("", scannerAction, request.signal);
      return NextResponse.json(result, { status: result.ok === false ? 503 : 200, headers: NO_STORE_HEADERS });
    } catch (error) {
      if (error instanceof Error && error.message === "request_aborted") return new NextResponse(null, { status: 499, headers: NO_STORE_HEADERS });
      return NextResponse.json({ error: "scanner_processor_unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
    }
  }

  if (!input.images?.length && !input.text?.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await runPython(JSON.stringify(input), "request", request.signal);
    if (result.ok === false) {
      return NextResponse.json(result, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof Error && error.message === "request_aborted") return new NextResponse(null, { status: 499, headers: NO_STORE_HEADERS });
    return NextResponse.json({ error: "python_processing_failed" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
