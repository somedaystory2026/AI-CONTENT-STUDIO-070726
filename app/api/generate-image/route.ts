import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, model, refImages, apiKey: bodyKey, provider, vertex } = await req.json();
    if (!prompt) return NextResponse.json({ error: "prompt 필드가 필요합니다." }, { status: 400 });

    const useModel = model || "gemini-2.5-flash-image";
    const parts: Array<any> = [{ text: prompt }];
    if (Array.isArray(refImages)) {
      for (const r of refImages) {
        if (r?.data && r?.mimeType) parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } });
      }
    }
    const body = { contents: [{ role: "user", parts }] };

    let upstream: Response;
    if (provider === "vertex") {
      const { accessToken, projectId, region } = vertex || {};
      if (!accessToken || !projectId || !region) {
        return NextResponse.json({ error: "Vertex 설정(accessToken/projectId/region)이 필요합니다." }, { status: 400 });
      }
      upstream = await fetch(`https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${useModel}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
    } else {
      const apiKey = bodyKey || process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "서버 또는 클라이언트에 GEMINI_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "알 수 없는 오류" }, { status: 500 });
  }
}
