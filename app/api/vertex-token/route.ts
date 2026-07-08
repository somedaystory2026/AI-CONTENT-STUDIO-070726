import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

function base64url(input: string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const { serviceAccount } = await req.json();
    if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
      return NextResponse.json({ error: "서비스 계정 JSON이 올바르지 않습니다 (client_email/private_key 누락)." }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(serviceAccount.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = `${signingInput}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`,
    });
    const data = await tokenRes.json();
    return NextResponse.json(data, { status: tokenRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Vertex AI 토큰 발급 중 오류가 발생했습니다." }, { status: 500 });
  }
}
