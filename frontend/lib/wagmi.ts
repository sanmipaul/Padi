import { createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: { [celo.id]: http("https://forno.celo.org") },
});
