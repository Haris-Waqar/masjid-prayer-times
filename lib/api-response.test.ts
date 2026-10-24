import { describe, expect, it } from "vitest";
import { readApiResponse } from "@/lib/api-response";

describe("readApiResponse", () => {
  it("returns a useful error for an empty failed response", async () => {
    const result = await readApiResponse(new Response(null, { status: 500 }));

    expect(result).toEqual({ error: "The server request failed (500)." });
  });

  it("preserves a structured API error", async () => {
    const result = await readApiResponse(
      Response.json({ error: "Server setup is incomplete." }, { status: 503 }),
    );

    expect(result).toEqual({ error: "Server setup is incomplete." });
  });

  it("reports malformed successful responses", async () => {
    const result = await readApiResponse(
      new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    );

    expect(result).toEqual({ error: "The server returned an invalid response." });
  });
});
