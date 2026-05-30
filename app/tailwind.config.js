import animate from "tailwindcss-animate";

function colorVariable(name) {
  return ({ opacityValue } = {}) => {
    if (opacityValue === undefined || String(opacityValue).startsWith("var(")) {
      return `var(${name})`;
    }

    const numericOpacity = Number(opacityValue);
    const opacity = Number.isFinite(numericOpacity) ? `${numericOpacity * 100}%` : opacityValue;
    return `color-mix(in oklch, var(${name}) ${opacity}, transparent)`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./interview-server.mjs", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: colorVariable("--border"),
        input: colorVariable("--input"),
        ring: colorVariable("--ring"),
        background: colorVariable("--background"),
        foreground: colorVariable("--foreground"),
        primary: {
          DEFAULT: colorVariable("--primary"),
          foreground: colorVariable("--primary-foreground"),
        },
        secondary: {
          DEFAULT: colorVariable("--secondary"),
          foreground: colorVariable("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: colorVariable("--destructive"),
          foreground: colorVariable("--destructive-foreground"),
        },
        muted: {
          DEFAULT: colorVariable("--muted"),
          foreground: colorVariable("--muted-foreground"),
        },
        accent: {
          DEFAULT: colorVariable("--accent"),
          foreground: colorVariable("--accent-foreground"),
        },
        popover: {
          DEFAULT: colorVariable("--popover"),
          foreground: colorVariable("--popover-foreground"),
        },
        card: {
          DEFAULT: colorVariable("--card"),
          foreground: colorVariable("--card-foreground"),
        },
        sidebar: {
          DEFAULT: colorVariable("--sidebar"),
          foreground: colorVariable("--sidebar-foreground"),
          primary: colorVariable("--sidebar-primary"),
          "primary-foreground": colorVariable("--sidebar-primary-foreground"),
          accent: colorVariable("--sidebar-accent"),
          "accent-foreground": colorVariable("--sidebar-accent-foreground"),
          border: colorVariable("--sidebar-border"),
          ring: colorVariable("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};
