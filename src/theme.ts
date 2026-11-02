import type { Palette, Typefaces } from "@kit";

// Starter placeholder only — a real build replaces this with the brief's
// design.palette / design.typefaces. The builder may never touch this file
// once a brief has been applied (see builder.md's "theme" constraint).
export const theme: { palette: Palette; typefaces: Typefaces } = {
  palette: {
    surface: "#F4F4F9",
    ink: "#1E1F3B",
    primary: "#3B3F8F",
    accent: "#F2B38C",
    muted: "#5A5D78",
  },
  typefaces: {
    heading: "Source Serif 4",
    body: "Public Sans",
  },
};
