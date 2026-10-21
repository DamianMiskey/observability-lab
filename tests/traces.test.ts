import { describe, expect, it } from "vitest";
import { GET as trace } from "@/app/api/trace/route";
import { flattenTrace, hexId } from "@/lib/grafana";

// Turning Tempo's answer into waterfall rows.

const tempoAnswer = {
  resourceSpans: [{
    resource: { attributes: [{ key: "cloud.platform", value: { stringValue: "cloudflare-workers" } }, { key: "cloud.region", value: { stringValue: "JNB" } }] },
    scopeSpans: [{
      spans: [
        // Ids as base64 (protobuf style), as Tempo may send them.
        { spanId: btoa(String.fromCharCode(0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08)), name: "GET /api/scores", kind: "SPAN_KIND_SERVER",
          startTimeUnixNano: "1760000000000000000", endTimeUnixNano: "1760000000900000000", attributes: [{ key: "http.route", value: { stringValue: "/api/scores" } }], status: {} },
        { spanId: "0a0b0c0d0e0f1011", parentSpanId: "0102030405060708", name: "SELECT scores", kind: 3,
          startTimeUnixNano: "1760000000005000000", endTimeUnixNano: "1760000000880000000", attributes: [{ key: "db.queries", value: { intValue: "1" } }], status: { code: "STATUS_CODE_ERROR", message: "timeout" } },
      ],
    }],
  }],
};

describe("flattenTrace", () => {
  it("normalises ids, kinds, times and status", () => {
    const [root, query] = flattenTrace(tempoAnswer);
    expect(root).toMatchObject({ spanId: "0102030405060708", parentSpanId: null, kind: "server", startMs: 0, durationMs: 900, error: null, platform: "cloudflare-workers", region: "JNB" });
    expect(root.attributes["http.route"]).toBe("/api/scores");
    expect(query).toMatchObject({ parentSpanId: "0102030405060708", kind: "client", startMs: 5, durationMs: 875, error: "timeout" });
    expect(query.attributes["db.queries"]).toBe(1);
  });

  it("reads Tempo's older 'batches' shape too, and hex ids as they are", () => {
    expect(flattenTrace({ batches: tempoAnswer.resourceSpans })).toHaveLength(2);
    expect(hexId("0A0B0C0D0E0F1011")).toBe("0a0b0c0d0e0f1011");
    expect(hexId(undefined)).toBeNull();
  });
});

describe("/api/trace", () => {
  it("validates the id and says when Grafana isn't configured", async () => {
    expect((await trace(new Request("http://x/api/trace?id=nope"))).status).toBe(400);
    delete process.env.GRAFANA_READ_TOKEN;
    expect((await trace(new Request(`http://x/api/trace?id=${"b".repeat(32)}`))).status).toBe(503);
  });
});
