// Fetch open-licensed stand-ins for the two licensed typefaces, under the filenames the app expects.
// Berkeley Mono -> JetBrains Mono (OFL). Camber -> Figtree (OFL). Google Sans Flex is already in the repo (OFL).
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const dir = join(process.cwd(), "src/app/fonts");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const want = [
  ["BerkeleyMono-Regular.woff2", "JetBrains+Mono:wght@400", 400, "normal"],
  ["BerkeleyMono-Bold.woff2", "JetBrains+Mono:wght@700", 700, "normal"],
  ["Camber-Regular.woff2", "Figtree:wght@400", 400, "normal"],
  ["Camber-Italic.woff2", "Figtree:ital,wght@1,400", 400, "italic"],
  ["Camber-Medium.woff2", "Figtree:wght@500", 500, "normal"],
  ["Camber-SemiBold.woff2", "Figtree:wght@600", 600, "normal"],
  ["Camber-Bold.woff2", "Figtree:wght@700", 700, "normal"],
];

async function latinUrl(family) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, { headers: { "User-Agent": UA } })).text();
  const block = css.split("/* latin */").pop() ?? css;
  const m = block.match(/url\((https:[^)]+\.woff2)\)/);
  if (!m) throw new Error(`no woff2 for ${family}`);
  return m[1];
}

await mkdir(dir, { recursive: true });
for (const [file, family] of want) {
  const path = join(dir, file);
  const exists = await access(path).then(() => true, () => false);
  if (exists && !process.argv.includes("--force")) { console.log(`keep  ${file} (already present)`); continue; }
  const url = await latinUrl(family);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path, buf);
  console.log(`wrote ${file} <- ${family} (${buf.length} bytes)`);
}
console.log("Done. These are stand-ins; the hosted site uses Berkeley Mono and Camber under their own licences.");
