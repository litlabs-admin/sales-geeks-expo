import JSZip from "jszip";
import { closeSql, getEventId, sql } from "./lib/phase2";
import { backendUrl, roleToken } from "./lib/phase4";

const eventId = await getEventId();
const token = await roleToken("admin");

const response = await fetch(backendUrl(`/admin/qr/print?event_id=${eventId}`), {
  headers: {
    authorization: `Bearer ${token}`
  }
});

if (!response.ok) {
  throw new Error(`Bulk print returned ${response.status}`);
}

const contentType = response.headers.get("content-type");
if (contentType !== "application/zip") {
  throw new Error(`Expected application/zip, saw ${contentType}`);
}

const zip = await JSZip.loadAsync(await response.arrayBuffer());
const pngFiles = Object.values(zip.files).filter((file) => !file.dir && file.name.endsWith(".png"));
const countRows = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.qr_codes
  where event_id = ${eventId}
    and active = true
`;

if (pngFiles.length !== countRows[0]?.count) {
  throw new Error(`Expected ${countRows[0]?.count} QR PNGs, saw ${pngFiles.length}`);
}

await closeSql();
console.log("Bulk QR print checks passed.");
