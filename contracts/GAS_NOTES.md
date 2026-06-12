# Gas Notes

## createGame
- Initialises 4×4 piece array (16 writes): ~200k gas cold
- USDM transferFrom (if wager): +30k gas

## rollDice
- Single storage write + keccak: ~30k gas

## movePiece + AI turns
- Worst case (3 AI × multiple moves): ~300-500k gas
- Capped at 20 iterations to bound gas usage

## Safe square check
- Linear scan of 8-element array per landing: negligible

## _endGame
- USDM transfer: +30k gas if player wins
