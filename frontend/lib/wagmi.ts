import { createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// ssr: true so wagmi doesn't diverge between server and client renders.
// The mount guard in page.tsx still prevents any wallet-dependent UI from
// showing until we're on the client.
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: true,
});
