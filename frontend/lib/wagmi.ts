import { createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { inAppWalletConnector } from "@thirdweb-dev/wagmi-adapter";
import { thirdwebClient } from "./thirdweb";

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [
    inAppWalletConnector({
      client: thirdwebClient,
      auth: {
        options: ["google", "apple", "discord", "email", "passkey"],
      },
    }),
    injected(), // MetaMask / MiniPay / other browser wallets
  ],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: false,
});
