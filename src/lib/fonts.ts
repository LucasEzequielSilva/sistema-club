import localFont from "next/font/local";

export const fontHeading = localFont({
  src: [
    { path: "../../public/fonts/HeadingPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/HeadingPro-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/HeadingPro-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../../public/fonts/HeadingPro-Heavy.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
});

export const fontDisplay = localFont({
  src: [
    { path: "../../public/fonts/BebasNeue-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/BebasNeue-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const fontBody = localFont({
  src: [
    { path: "../../public/fonts/Raleway-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Raleway-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/Raleway-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Raleway-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
