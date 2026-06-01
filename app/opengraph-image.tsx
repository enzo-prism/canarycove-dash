import { ImageResponse } from "next/og";

export const alt = "Canary Cove · Form Submissions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#faf9f6",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "rgba(44,122,75,0.10)",
            color: "#2c7a4b",
            marginBottom: 40,
          }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2c7a4b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "#1a1712",
          }}
        >
          Form Submissions
        </div>
        <div style={{ fontSize: 36, color: "#73726c", marginTop: 16 }}>
          canarycove.com · contact &amp; booking enquiries
        </div>
      </div>
    ),
    { ...size }
  );
}
