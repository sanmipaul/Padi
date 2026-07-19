import { createThirdwebClient, defineChain } from "thirdweb";

// NEXT_PUBLIC_ vars are inlined at build time. The placeholder prevents
// createThirdwebClient from throwing during SSG when the var isn't in .env.local.
export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "00000000000000000000000000000000",
});

// Celo mainnet — chainId 42220
export const celoChainTw = defineChain(42220);
