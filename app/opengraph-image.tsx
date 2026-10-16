import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import enMessages from "@/messages/en.json";

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const brandBackground = "#0f172a";
const brandText = "#f8fafc";
const brandMuted = "#cbd5e1";

export default async function OpenGraphImage() {
  const markPath = path.join(process.cwd(), "public/brand/oricrew-mark.png");
  const markBuffer = await readFile(markPath);
  const markSrc = `data:image/png;base64,${markBuffer.toString("base64")}`;

  const siteName = enMessages.Seo.siteName;
  const tagline = enMessages.Home.title;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: brandBackground,
        padding: "72px 96px",
      }}
    >
      <img
        alt=""
        height={72}
        src={markSrc}
        style={{ objectFit: "contain" }}
        width={178}
      />
      <div
        style={{
          marginTop: 40,
          fontSize: 96,
          fontWeight: 700,
          color: brandText,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        {siteName}
      </div>
      <p
        style={{
          marginTop: 32,
          maxWidth: 960,
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1.2,
          color: brandMuted,
        }}
      >
        {tagline}
      </p>
    </div>,
    {
      ...size,
    },
  );
}
