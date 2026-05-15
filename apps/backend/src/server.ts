import { serve } from "@hono/node-server";
import { createApp } from "./http/app";

const port = Number(process.env.PORT ?? 8081);

serve(
  {
    fetch: createApp().fetch,
    port
  },
  () => {
    console.log(`Backend listening on http://localhost:${port}`);
  }
);
