import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Acelerator — Método Acelerador de Ganancias by Matías Randazzo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000e2b",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Left: Text block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
              color: "#8aebda",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Método Acelerador de Ganancias
          </div>
          <div
            style={{
              fontSize: 130,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: -3,
              display: "flex",
            }}
          >
            ACELERATOR
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: "#cbd5e1",
              lineHeight: 1.25,
              maxWidth: 620,
              marginTop: 18,
              display: "flex",
            }}
          >
            Gestión financiera para pymes argentinas. Ventas, costos y rentabilidad en una sola pantalla.
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#94a3b8",
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ display: "flex" }}>by</span>
            <span style={{ color: "#ffffff", fontWeight: 700, display: "flex" }}>Matías Randazzo</span>
          </div>
        </div>

        {/* Right: OK icon (composed in SVG via JSX) */}
        <div
          style={{
            width: 360,
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* Halo turquesa */}
          <div
            style={{
              position: "absolute",
              width: 360,
              height: 360,
              borderRadius: 200,
              background: "#0052fe",
              opacity: 0.18,
              filter: "blur(40px)",
              display: "flex",
            }}
          />
          {/* Tile */}
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 56,
              background: "#0052fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 30px 80px rgba(0,82,254,0.35)",
              position: "relative",
              gap: 14,
            }}
          >
            {/* O */}
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                border: "20px solid #ffffff",
                display: "flex",
              }}
            />
            {/* L (formada con dos rectángulos) */}
            <div
              style={{
                position: "relative",
                width: 80,
                height: 130,
                display: "flex",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 22,
                  height: 130,
                  background: "#8aebda",
                  borderRadius: 4,
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: 80,
                  height: 22,
                  background: "#8aebda",
                  borderRadius: 4,
                  display: "flex",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
