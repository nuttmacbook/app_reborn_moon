import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const appUrl = String(env.VITE_APP_URL ?? "").trim().replace(/\/+$/, "");

    return {
        plugins: [
            tailwindcss(),
            {
                name: "app-url",
                transformIndexHtml: (html) => html.replaceAll("__APP_URL__", appUrl),
            },
        ],
    };
});
