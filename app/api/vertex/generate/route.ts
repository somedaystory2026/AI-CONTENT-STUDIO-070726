import { NextResponse } from "next/server";
import crypto from "node:crypto";

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signServiceAccountJwt(serviceAccount: any, scope: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedClaim = base64url(Buffer.from(JSON.stringify(claimSet)));
  const signInput = `${encodedHeader}.${encodedClaim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  return `${signInput}.${base64url(signature)}`;
}

async function getAccessToken(serviceAccount: any) {
  const jwt = signServiceAccountJwt(serviceAccount, "https://www.googleapis.com/auth/cloud-platform");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`구글 토큰 발급 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const { serviceAccount, region = "us-central1", model = "gemini-2.0-flash-001", prompt } = await req.json();
    if (!serviceAccount?.private_key || !serviceAccount?.client_email || !serviceAccount?.project_id) {
      return NextResponse.json({ error: "서비스 계정 JSON이 올바르지 않습니다." }, { status: 400 });
    }
    if (!prompt) return NextResponse.json({ error: "prompt가 비어있습니다." }, { status: 400 });
    const accessToken = await getAccessToken(serviceAccount);
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${serviceAccount.project_id}/locations/${region}/publishers/google/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw new Error(`Vertex AI 호출 실패 (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return NextResponse.json({ text: parts.map((p: any) => p.text || "").join("") });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Vertex AI 호출 실패" }, { status: 500 });
  }
}
