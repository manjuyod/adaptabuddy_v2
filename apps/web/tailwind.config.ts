import type { Config } from "tailwindcss";

import { UI_PALETTE } from "./src/lib/ui/palette";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ui: {
          "deep-brown": UI_PALETTE.core.deepBrown,
          "soft-brown": UI_PALETTE.core.softBrown,
          "muted-clay": UI_PALETTE.core.mutedClay,
          "warm-parchment": UI_PALETTE.core.warmParchment,
          "light-cream": UI_PALETTE.core.lightCream,
          "gold-accent": UI_PALETTE.core.goldAccent,
          "dark-gold": UI_PALETTE.core.darkGold,
          "muted-plum": UI_PALETTE.core.mutedPlum
        },
        status: {
          success: UI_PALETTE.status.success,
          warning: UI_PALETTE.status.warning,
          error: UI_PALETTE.status.error,
          info: UI_PALETTE.status.info
        },
        surface: {
          DEFAULT: "#0f172a",
          raised: "#111827"
        }
      },
      borderRadius: {
        lg: "12px"
      }
    }
  },
  plugins: []
};

export default config;
