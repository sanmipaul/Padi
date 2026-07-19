"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ConnectEmbed, darkTheme } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { thirdwebClient, celoChainTw } from "@/lib/thirdweb";

// Wallet config for ConnectEmbed (separate from wagmi connector — controls UI options)
const wallets = [
  inAppWallet({ auth: { options: ["google", "apple", "discord", "email", "passkey"] } }),
];

const theme = darkTheme({
  colors: {
    primaryButtonBg:    "#7B61FF",
    primaryButtonText:  "#ffffff",
    accentButtonBg:     "rgba(123,97,255,.15)",
    accentButtonText:   "#C5C5D8",
    modalBg:            "#0A0A14",
    borderColor:        "rgba(255,255,255,.1)",
    separatorLine:      "rgba(255,255,255,.06)",
    secondaryText:      "#74748C",
    primaryText:        "#ECECF2",
    connectedButtonBg:  "#0A0A14",
    skeletonBg:         "rgba(255,255,255,.06)",
    selectedTextColor:  "#7B61FF",
    selectedTextBg:     "rgba(123,97,255,.12)",
    inputAutofillBg:    "#0A0A14",
    scrollbarBg:        "rgba(255,255,255,.08)",
    success:            "#34E0C4",
    danger:             "#FF5C8A",
  },
  fontFamily: "var(--font-manrope), 'Manrope', sans-serif",
});

export default function AuthModal({ open, onClose, onGuest }: {
  open: boolean;
  onClose: () => void;
  onGuest: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(4,4,9,.92)", backdropFilter: "blur(12px)",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="auth-card"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "100%", maxWidth: 420,
              background: "#0A0A14",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 48px 120px -24px rgba(0,0,0,.95), 0 0 0 1px rgba(123,97,255,.1)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px 12px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="22" height="22" viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }}>
                  <defs>
                    <linearGradient id="amTile" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#8B7CFF"/><stop offset="1" stopColor="#5C6BFF"/>
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#amTile)"/>
                  <path d="M50 81 C41 64 31 57 31 40 A19 19 0 1 1 69 40 C69 57 59 64 50 81 Z" fill="#fff"/>
                  <circle cx="50" cy="38" r="8.6" fill="#6A5CF5"/>
                  <circle cx="50" cy="38" r="3.4" fill="#34E0C4"/>
                </svg>
                <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "-.3px", color: "#ECECF2" }}>
                  Sign in to Padi
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#74748C", fontSize: 18, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}
              >×</button>
            </div>

            {/* Thirdweb ConnectEmbed — handles Google, Apple, Discord, email OTP, passkey */}
            <ConnectEmbed
              client={thirdwebClient}
              chain={celoChainTw}
              wallets={wallets}
              theme={theme}
              showThirdwebBranding={false}
              onConnect={onClose}
            />

            {/* Guest footer */}
            <div style={{
              padding: "10px 20px 16px",
              borderTop: "1px solid rgba(255,255,255,.06)",
              textAlign: "center",
            }}>
              <span style={{ color: "#4A4A5C", fontSize: 12, fontWeight: 500 }}>
                Just exploring?{" "}
              </span>
              <button
                onClick={onGuest}
                style={{ background: "none", border: "none", color: "#8B7CFF", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Play as guest
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
