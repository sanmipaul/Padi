import { createThirdwebClient, defineChain } from "thirdweb";

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? "",
});

// Celo mainnet — chainId 42220
export const celoChainTw = defineChain(42220);
