"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePageClient() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to create room");
      sessionStorage.setItem(
        `clipboard-token-${payload.roomId}`,
        JSON.stringify(payload),
      );
      router.push(`/room/${payload.roomId}`);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Unable to create room",
      );
    } finally {
      setLoading(false);
    }
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = roomId.trim().toLowerCase();
    if (!normalized || normalized.length < 4) {
      setError("Use the 8-character room code.");
      return;
    }
    router.push(`/room/${normalized}`);
  }


  return (
    <>
      <header
        style={{
          backgroundColor: "var(--cy-surface)",
          borderBottom: "1px solid var(--cy-border-strong)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            width: "100%",
            maxWidth: "1280px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "24px",
              lineHeight: "32px",
              letterSpacing: "-0.01em",
              fontWeight: 700,
              color: "var(--cy-primary-text)",
            }}
          >
            ◈ ClipYard
          </div>
          <nav style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <a
              href="#how-it-works"
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                color: "var(--cy-text-secondary)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "var(--cy-primary-text)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "var(--cy-text-secondary)")
              }
            >
              How it works
            </a>
            <a
              href="https://github.com/mahesh2-lab/clipYard"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                color: "var(--cy-text-secondary)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "var(--cy-primary-text)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "var(--cy-text-secondary)")
              }
            >
              GitHub
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* ── Main Canvas ── */}
      <main
        style={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ── Hero Section ── */}
        <section
          style={{
            textAlign: "center",
            maxWidth: "672px",
            marginBottom: "96px",
            marginTop: "48px",
          }}
        >
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "14px",
              lineHeight: "20px",
              letterSpacing: "0.1em",
              fontWeight: 500,
              color: "var(--cy-primary)",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            Real-Time Text Transfer
          </div>

          <h1
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "clamp(32px, 5vw, 48px)",
              lineHeight: "1.15",
              letterSpacing: "-0.02em",
              fontWeight: 700,
              color: "var(--cy-text)",
              marginBottom: "24px",
            }}
          >
            Send text between your devices.
          </h1>

          <p
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "18px",
              lineHeight: "28px",
              color: "var(--cy-text-secondary)",
              marginBottom: "40px",
            }}
          >
            A temporary clipboard for moving text between your laptop, phone,
            and desktop. No account. No setup.
          </p>

          {/* CTA Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <button
              id="create-clipboard-btn"
              onClick={createRoom}
              disabled={loading}
              style={{
                backgroundColor: "var(--cy-primary)",
                color: "var(--cy-on-primary)",
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "4px",
                border: "1.5px solid var(--cy-border)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.currentTarget.style.backgroundColor) = "var(--cy-primary-text)";
              }}
              onMouseLeave={(e) => {
                if (!loading)
                  (e.currentTarget.style.backgroundColor) = "var(--cy-primary)";
              }}
            >
              {loading ? "Creating…" : "Create Clipboard →"}
            </button>

            <span
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                color: "var(--cy-text-secondary)",
              }}
            >
              or
            </span>

            {/* Join Module */}
            <form
              onSubmit={joinRoom}
              style={{
                backgroundColor: "var(--cy-surface-white)",
                border: "1.5px solid var(--cy-border)",
                borderRadius: "4px",
                padding: "8px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: "0.02em",
                  fontWeight: 500,
                  color: "var(--cy-text-secondary)",
                  padding: "0 12px",
                  borderRight: "1px solid var(--cy-border)",
                  marginRight: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                JOIN EXISTING
              </span>
              <input
                id="room-code-input"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setError("");
                }}
                placeholder="Room code"
                maxLength={8}
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "13px",
                  lineHeight: "18px",
                  backgroundColor: "transparent",
                  border: "none",
                  padding: "8px",
                  width: "128px",
                  color: "var(--cy-text)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "14px",
                  letterSpacing: "0.02em",
                  fontWeight: 500,
                  color: "var(--cy-primary)",
                  background: "none",
                  border: "none",
                  padding: "0 12px",
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget.style.color) = "var(--cy-primary-text)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget.style.color) = "var(--cy-primary)")
                }
              >
                Join →
              </button>
            </form>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                marginTop: "12px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                color: "var(--cy-error)",
              }}
            >
              {error}
            </p>
          )}
        </section>

        {/* ── Product Preview Panel ── */}
        <section
          style={{
            width: "100%",
            maxWidth: "896px",
            marginBottom: "128px",
            backgroundColor: "var(--cy-surface-white)",
            border: "1.5px solid var(--cy-border)",
            borderRadius: "4px",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 24px",
              borderBottom: "1.5px solid var(--cy-border)",
              backgroundColor: "var(--cy-surface)",
              borderRadius: "4px 4px 0 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--cy-primary)",
                }}
              />
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: "0.05em",
                  fontWeight: 500,
                  color: "var(--cy-text)",
                  textTransform: "uppercase",
                }}
              >
                Clipboard • Connected
              </span>
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                lineHeight: "18px",
                backgroundColor: "var(--cy-surface-container-high)",
                padding: "4px 12px",
                borderRadius: "2px",
                border: "1.5px solid var(--cy-border)",
                color: "var(--cy-text-secondary)",
              }}
            >
              ID: K7Q9-X2MP
            </div>
          </div>

          {/* Panel Body */}
          <div
            style={{
              padding: "24px",
              height: "256px",
              backgroundColor: "var(--cy-surface-white)",
              position: "relative",
            }}
          >
            <textarea
              readOnly
              defaultValue={`git clone https://github.com/example/clipyard.git\ncd clipyard\nnpm install\nnpm run dev\n\n// Database connection string\npostgres://user:pass@localhost:5432/clipyard_db`}
              style={{
                width: "100%",
                height: "100%",
                resize: "none",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                lineHeight: "18px",
                color: "var(--cy-text)",
                padding: 0,
              }}
            />
            <button
              title="Copy to clipboard"
              onClick={() => {
                navigator.clipboard.writeText(
                  `git clone https://github.com/example/clipyard.git\ncd clipyard\nnpm install\nnpm run dev\n\n// Database connection string\npostgres://user:pass@localhost:5432/clipyard_db`,
                );
              }}
              style={{
                position: "absolute",
                bottom: "24px",
                right: "24px",
                backgroundColor: "var(--cy-surface-container-highest)",
                border: "1.5px solid var(--cy-border)",
                borderRadius: "2px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget.style.backgroundColor) = "var(--cy-surface-container-high)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget.style.backgroundColor) = "var(--cy-surface-container-highest)")
              }
            >
              <span className="material-symbols-outlined" style={{ color: "var(--cy-text-secondary)", fontSize: "20px" }}>
                content_copy
              </span>
            </button>
          </div>

          {/* Panel Footer */}
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1.5px solid var(--cy-border)",
              backgroundColor: "var(--cy-surface)",
              borderRadius: "0 0 4px 4px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--cy-text-secondary)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>248 CHARACTERS</span>
            <span>SYNCED 2 DEVICES</span>
          </div>
        </section>

        {/* ── How It Works & Utility Highlights ── */}
        <div
          id="how-it-works"
          style={{
            width: "100%",
            maxWidth: "1024px",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            marginBottom: "80px",
          }}
        >
          {/* How It Works – 8 cols */}
          <section
            style={{
              gridColumn: "span 8",
              display: "flex",
              flexWrap: "wrap",
              gap: "24px",
            }}
          >
            {[
              {
                num: "01 CREATE",
                title: "Generate a room",
                desc: "Click create to instantly get a secure, temporary workspace.",
              },
              {
                num: "02 SHARE",
                title: "Connect devices",
                desc: "Use the 8-character code or QR to join from any device.",
              },
              {
                num: "03 COPY",
                title: "Sync text instantly",
                desc: "Paste on one device, copy on the other. Disappears when closed.",
              },
            ].map((step) => (
              <div
                key={step.num}
                style={{ flex: "1 1 160px", display: "flex", flexDirection: "column" }}
              >
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "14px",
                    letterSpacing: "0.02em",
                    fontWeight: 500,
                    color: "var(--cy-primary)",
                    marginBottom: "8px",
                  }}
                >
                  {step.num}
                </span>
                <div
                  style={{
                    height: "1.5px",
                    width: "100%",
                    backgroundColor: "var(--cy-border)",
                    marginBottom: "16px",
                  }}
                />
                <h3
                  style={{
                    fontFamily: "Hanken Grotesk, sans-serif",
                    fontSize: "16px",
                    lineHeight: "24px",
                    fontWeight: 600,
                    color: "var(--cy-text)",
                    marginBottom: "4px",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: "Hanken Grotesk, sans-serif",
                    fontSize: "14px",
                    lineHeight: "20px",
                    color: "var(--cy-text-secondary)",
                  }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </section>

          {/* Utility Highlights – 4 cols */}
          <section
            style={{
              gridColumn: "span 4",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              justifyContent: "center",
              paddingLeft: "32px",
              borderLeft: "1px solid var(--cy-border)",
            }}
          >
            {[
              "NO ACCOUNT REQUIRED",
              "REAL-TIME WEBSOCKET SYNC",
              "E2E ENCRYPTION OPTION",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "var(--cy-primary)", fontSize: "16px" }}
                >
                  check_circle
                </span>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "13px",
                    lineHeight: "18px",
                    color: "var(--cy-text)",
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          backgroundColor: "var(--cy-surface-container)",
          borderTop: "1px solid var(--cy-border-strong)",
          width: "100%",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 24px",
            width: "100%",
            maxWidth: "1280px",
            margin: "0 auto",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "24px",
              lineHeight: "32px",
              letterSpacing: "-0.01em",
              fontWeight: 700,
              color: "var(--cy-text)",
            }}
          >
            ◈ CLIPYARD
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "16px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--cy-text-secondary)",
            }}
          >
            <span>© 2026 ClipYard. All rights reserved.</span>
            <nav style={{ display: "flex", gap: "16px" }}>
              {["Terms", "Privacy", "Support"].map((link) => (
                <a
                  key={link}
                  href="#"
                  style={{
                    color: "var(--cy-text-secondary)",
                    textDecoration: "none",
                    opacity: 0.9,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget.style.opacity) = "1")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget.style.opacity) = "0.9")
                  }
                >
                  {link}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
