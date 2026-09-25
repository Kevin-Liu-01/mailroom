import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "mailroom: a sorting room for your Gmail";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/BerkeleyMono-Bold.ttf")),
    readFile(join(process.cwd(), "src/app/fonts/BerkeleyMono-Regular.ttf")),
  ]);
  const cells = Array.from({ length: 9 }, (_, i) => i);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff", color: "#0a0a0a", fontFamily: "Berkeley", padding: 64, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0a0a0a12 1px, transparent 1px), linear-gradient(90deg, #0a0a0a12 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ display: "flex", flexWrap: "wrap", width: 132, height: 132, border: "6px solid #0a0a0a", borderRadius: 10, background: "#fff" }}>
              {cells.map((i) => (
                <div key={i} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRight: i % 3 === 2 ? "none" : "3px solid #0a0a0a", borderBottom: i > 5 ? "none" : "3px solid #0a0a0a", background: i === 4 ? "#0a0a0a" : "#fff" }}>
                  {i === 4 ? <div style={{ width: 24, height: 18, background: "#fff", borderRadius: 2 }} /> : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: 2 }}>mailroom</div>
              <div style={{ fontSize: 26, color: "#6a6a6a", letterSpacing: 4, textTransform: "uppercase" }}>a sorting room for your gmail</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 28, lineHeight: 1.35 }}>
            <div style={{ display: "flex" }}>rules you can read · typed AI judgments for pennies</div>
            <div style={{ display: "flex" }}>natural-language search · a straight answer to what to trash</div>
            <div style={{ display: "flex", color: "#6a6a6a", fontSize: 22, marginTop: 10 }}>every run previews first and can be undone · mailroom.kevinliu.studio</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Berkeley", data: bold, weight: 700, style: "normal" }, { name: "Berkeley", data: regular, weight: 400, style: "normal" }] },
  );
}
