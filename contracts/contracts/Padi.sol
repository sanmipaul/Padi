// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Padi — on-chain Ludo vs AI on Celo
/// @notice Single-player Ludo: you vs 1-3 AI opponents. AI runs in the same tx as your move.
/// @dev Uses block.prevrandao for dice randomness. Safe squares prevent captures.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint8 public constant BOARD_SIZE   = 52;
    uint8 public constant HOME_STRETCH = 6;
    uint8 public constant FINISHED_POS = 59;
    uint8 public constant AT_BASE      = 0;
    uint8 public constant PIECES       = 4;

    enum GameState { ACTIVE, FINISHED }

    struct Game {
        address player;
        uint8[4][4] pieces;
        uint8 aiCount;
        uint8 currentSeat;
        uint8 lastDice;
        bool  diceRolled;
        GameState state;
        uint256 wager;
        address winner;
        uint256 nonce;
    }

    uint256 private _gameCounter;
    mapping(uint256 => Game) private games;
    mapping(address => uint256[]) public playerGames;
    mapping(address => uint256) public totalWins;
    uint256 public weeklyPrizePool;
    uint256 public platformFeeBalance;

    event GameCreated(uint256 indexed gameId, address indexed player, uint8 aiCount);
    event DiceRolled(uint256 indexed gameId, uint8 seat, uint8 dice);
    event PieceMoved(uint256 indexed gameId, uint8 seat, uint8 piece, uint8 from, uint8 to);
    event PieceCaptured(uint256 indexed gameId, uint8 capturerSeat, uint8 capturedSeat, uint8 piece);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize);
    event PrizeDistributed(address indexed recipient, uint256 amount);
    event TurnChanged(uint256 indexed gameId, uint8 seat);

    uint8[8] private SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }

    function createGame(uint8 aiCount, uint256 wagerAmount) external nonReentrant returns (uint256 gameId) {
        require(aiCount >= 1 && aiCount <= 3, "aiCount 1-3");
        if (wagerAmount > 0) {
            require(usdm.transferFrom(msg.sender, address(this), wagerAmount), "transfer failed");
        }
        gameId = ++_gameCounter;
        Game storage g = games[gameId];
        g.player  = msg.sender;
        g.aiCount = aiCount;
        g.wager   = wagerAmount;
        g.state   = GameState.ACTIVE;
        for (uint8 s = 0; s < 4; s++) {
            for (uint8 p = 0; p < 4; p++) g.pieces[s][p] = AT_BASE;
        }
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }

    function rollDice(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender,      "not player");
        require(g.currentSeat == 0,          "not your turn");
        require(!g.diceRolled,               "already rolled");
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, g.nonce))) % 6) + 1;
        g.lastDice    = dice;
        g.diceRolled  = true;
        emit DiceRolled(gameId, 0, dice);
    }

    function movePiece(uint256 gameId, uint8 pieceIdx) external nonReentrant {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender,      "not player");
        require(g.currentSeat == 0,          "not your turn");
        require(g.diceRolled,                "roll first");
        require(pieceIdx < PIECES,           "bad piece");
        uint8 pos    = g.pieces[0][pieceIdx];
        require(pos != FINISHED_POS,                         "already home");
        require(pos != AT_BASE || g.lastDice == 6,           "need 6 to leave base");
        uint8 newPos = pos == AT_BASE ? 1 : pos + g.lastDice;
        require(!(pos > BOARD_SIZE && newPos > FINISHED_POS),"overshoot");
        uint8 from = pos;
        _applyMove(gameId, 0, pieceIdx, newPos);
        g.diceRolled = false;
        emit PieceMoved(gameId, 0, pieceIdx, from, newPos);
        if (_isAllFinished(games[gameId], 0)) {
            _endGame(gameId, games[gameId].player);
            return;
        }
        _runAITurns(gameId);
    }

    /// @notice Play the entire game in one transaction.
    /// @param suggestedPieces  One piece index per player turn. If a suggested piece
    ///                         is invalid for the dice that gets rolled the contract
    ///                         falls back to the first valid piece, or skips the turn.
    function completeBatch(uint256 gameId, uint8[] calldata suggestedPieces) external nonReentrant {
        Game storage g = games[gameId];
        require(g.state  == GameState.ACTIVE, "not active");
        require(g.player == msg.sender,       "not player");
        require(g.currentSeat == 0,           "not player turn");
        require(!g.diceRolled,                "has pending roll");

        for (uint256 i = 0; i < suggestedPieces.length; i++) {
            if (g.state != GameState.ACTIVE) break;

            // Roll dice for the player
            uint8 dice = _rollDiceFor(gameId, 0);

            // Find which piece to move (suggested → fall back → skip)
            uint8 pieceIdx = type(uint8).max;
            if (_isPieceMovable(g, suggestedPieces[i], dice)) {
                pieceIdx = suggestedPieces[i];
            } else {
                for (uint8 p = 0; p < PIECES; p++) {
                    if (_isPieceMovable(g, p, dice)) { pieceIdx = p; break; }
                }
            }

            if (pieceIdx == type(uint8).max) {
                // No valid move — pass turn to AI
                _runAITurns(gameId);
                continue;
            }

            uint8 pos    = g.pieces[0][pieceIdx];
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            uint8 from   = pos;
            _applyMove(gameId, 0, pieceIdx, newPos);
            emit PieceMoved(gameId, 0, pieceIdx, from, newPos);

            if (_isAllFinished(games[gameId], 0)) {
                _endGame(gameId, games[gameId].player);
                return;
            }

            _runAITurns(gameId);
        }
    }

    function _isPieceMovable(Game storage g, uint8 pieceIdx, uint8 dice) internal view returns (bool) {
        if (pieceIdx >= PIECES) return false;
        uint8 pos = g.pieces[0][pieceIdx];
        if (pos == FINISHED_POS) return false;
        if (pos == AT_BASE && dice != 6) return false;
        uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
        if (pos > BOARD_SIZE && newPos > FINISHED_POS) return false;
        return true;
    }

    function getGame(uint256 gameId) external view returns (
        address player, uint8[4][4] memory pieces, uint8 aiCount,
        uint8 currentSeat, uint8 lastDice, bool diceRolled,
        uint8 state, uint256 wager, address winner
    ) {
        Game storage g = games[gameId];
        return (g.player, g.pieces, g.aiCount, g.currentSeat, g.lastDice, g.diceRolled, uint8(g.state), g.wager, g.winner);
    }

    function getPlayerGames(address p) external view returns (uint256[] memory) { return playerGames[p]; }
    function totalGames() external view returns (uint256) { return _gameCounter; }

    function withdrawPlatformFee(address to) external onlyOwner {
        uint256 amount = platformFeeBalance; platformFeeBalance = 0; usdm.transfer(to, amount);
    }
    function addToPrizePool(uint256 amount) external {
        require(usdm.transferFrom(msg.sender, address(this), amount), "transfer failed");
        weeklyPrizePool += amount;
    }
    function distributePrize(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(total <= weeklyPrizePool, "exceeds pool");
        weeklyPrizePool -= total;
        for (uint256 i = 0; i < recipients.length; i++) {
            usdm.transfer(recipients[i], amounts[i]);
            emit PrizeDistributed(recipients[i], amounts[i]);
        }
    }
    function emergencyRefund(uint256 gameId) external onlyOwner {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.wager > 0, "no wager");
        g.state = GameState.FINISHED;
        usdm.transfer(g.player, g.wager);
    }

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) if (g.pieces[seat][p] != FINISHED_POS) return false;
        return true;
    }

    function _aiPickPiece(Game storage g, uint8 seat, uint8 dice) internal view returns (uint8) {
        uint8 best = type(uint8).max; uint8 bestScore = 0;
        for (uint8 p = 0; p < PIECES; p++) {
            uint8 pos = g.pieces[seat][p];
            if (pos == FINISHED_POS) continue;
            if (pos == AT_BASE && dice != 6) continue;
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue;
            uint8 score = pos == AT_BASE ? 50 : pos;
            if (newPos >= 1 && newPos <= BOARD_SIZE) {
                uint8 myGlobal = _globalPos(seat, newPos);
                if (!_isSafe(myGlobal)) {
                    for (uint8 sp = 0; sp < PIECES; sp++) {
                        uint8 ppos = g.pieces[0][sp];
                        if (ppos >= 1 && ppos <= BOARD_SIZE && _globalPos(0, ppos) == myGlobal) score = 200;
                    }
                }
            }
            if (score > bestScore) { bestScore = score; best = p; }
        }
        return best;
    }

    function _runAITurns(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 totalSeats = 1 + g.aiCount;
        uint8 maxIter = 20; uint8 iter = 0;
        while (g.state == GameState.ACTIVE && iter < maxIter) {
            iter++;
            uint8 seat = g.currentSeat == 0 ? 1 : g.currentSeat;
            if (seat >= totalSeats) { g.currentSeat = 0; emit TurnChanged(gameId, 0); break; }
            g.currentSeat = seat;
            emit TurnChanged(gameId, seat);
            uint8 dice = _rollDiceFor(gameId, seat);
            if (!_hasValidMove(g, seat, dice)) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) { emit TurnChanged(gameId, 0); break; }
                continue;
            }
            uint8 pick = _aiPickPiece(g, seat, dice);
            if (pick == type(uint8).max) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) { emit TurnChanged(gameId, 0); break; }
                continue;
            }
            uint8 from = g.pieces[seat][pick];
            uint8 newPos = from == AT_BASE ? 1 : from + dice;
            _applyMove(gameId, seat, pick, newPos);
            emit PieceMoved(gameId, seat, pick, from, newPos);
            if (_isAllFinished(g, seat)) { _endGame(gameId, address(0)); return; }
            g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
            if (g.currentSeat == 0) { emit TurnChanged(gameId, 0); break; }
        }
    }

    function _endGame(uint256 gameId, address winner) internal {
        Game storage g = games[gameId];
        g.state = GameState.FINISHED; g.winner = winner;
        uint256 prize = 0;
        if (g.wager > 0) {
            if (winner == g.player) {
                prize              = (g.wager * 99)  / 100;
                platformFeeBalance += (g.wager * 5)   / 1000;
                weeklyPrizePool   += g.wager - prize - (g.wager * 5) / 1000;
                usdm.transfer(winner, prize);
            } else {
                weeklyPrizePool += g.wager;
            }
        }
        if (winner == g.player) totalWins[g.player]++;
        emit GameFinished(gameId, winner, prize);
    }

    function _rollDiceFor(uint256 gameId, uint8 seat) internal returns (uint8) {
        Game storage g = games[gameId]; g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, seat, g.nonce))) % 6) + 1;
        emit DiceRolled(gameId, seat, dice); return dice;
    }

    function _hasValidMove(Game storage g, uint8 seat, uint8 dice) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            uint8 pos = g.pieces[seat][p];
            if (pos == FINISHED_POS) continue;
            if (pos == AT_BASE && dice != 6) continue;
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue;
            return true;
        }
        return false;
    }

    function _isSafe(uint8 globalPos) internal view returns (bool) {
        for (uint8 i = 0; i < 8; i++) if (SAFE_SQUARES[i] == globalPos) return true;
        return false;
    }

    function _globalPos(uint8 seat, uint8 relPos) internal pure returns (uint8) {
        if (relPos == 0 || relPos > BOARD_SIZE) return relPos;
        uint8[4] memory offsets = [0, 13, 26, 39];
        return uint8((offsets[seat] + relPos - 1) % BOARD_SIZE);
    }

    function _applyMove(uint256 gameId, uint8 seat, uint8 pieceIdx, uint8 newPos) internal {
        Game storage g = games[gameId];
        g.pieces[seat][pieceIdx] = newPos;
        if (newPos >= 1 && newPos <= BOARD_SIZE) {
            uint8 myGlobal = _globalPos(seat, newPos);
            if (!_isSafe(myGlobal)) _capture(gameId, seat, myGlobal);
        }
    }

    function _capture(uint256 gameId, uint8 attackerSeat, uint8 globalPos) internal {
        Game storage g = games[gameId];
        uint8 totalSeats = 1 + g.aiCount;
        for (uint8 s = 0; s < totalSeats; s++) {
            if (s == attackerSeat) continue;
            for (uint8 p = 0; p < PIECES; p++) {
                uint8 pos = g.pieces[s][p];
                if (pos == 0 || pos > BOARD_SIZE) continue;
                if (_globalPos(s, pos) == globalPos) {
                    g.pieces[s][p] = AT_BASE;
                    emit PieceCaptured(gameId, attackerSeat, s, p);
                }
            }
        }
    }
}
