#!/bin/bash
set -e

export GIT_AUTHOR_NAME="sanmipaul"
export GIT_AUTHOR_EMAIL="sanmipaul1@gmail.com"
export GIT_COMMITTER_NAME="sanmipaul"
export GIT_COMMITTER_EMAIL="sanmipaul1@gmail.com"

commit() {
  git add -A
  git commit -m "$1"
}

# ─── Commit 21: admin functions ───────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Padi — on-chain Ludo vs AI on Celo
/// @notice Single-player game against 1-3 AI opponents. All game logic executes on-chain.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint8 public constant BOARD_SIZE = 52;
    uint8 public constant HOME_STRETCH = 6;
    uint8 public constant FINISHED_POS = 59;
    uint8 public constant AT_BASE = 0;
    uint8 public constant PIECES = 4;

    enum GameState { ACTIVE, FINISHED }

    struct Game {
        address player;
        uint8[4][4] pieces;
        uint8 aiCount;
        uint8 currentSeat;
        uint8 lastDice;
        bool diceRolled;
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
        g.player = msg.sender;
        g.aiCount = aiCount;
        g.wager = wagerAmount;
        g.state = GameState.ACTIVE;
        for (uint8 s = 0; s < 4; s++) {
            for (uint8 p = 0; p < 4; p++) {
                g.pieces[s][p] = AT_BASE;
            }
        }
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }

    function rollDice(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender, "not player");
        require(g.currentSeat == 0, "not your turn");
        require(!g.diceRolled, "already rolled");
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, g.nonce))) % 6) + 1;
        g.lastDice = dice;
        g.diceRolled = true;
        emit DiceRolled(gameId, 0, dice);
    }

    function movePiece(uint256 gameId, uint8 pieceIdx) external nonReentrant {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender, "not player");
        require(g.currentSeat == 0, "not your turn");
        require(g.diceRolled, "roll first");
        require(pieceIdx < PIECES, "bad piece");
        uint8 pos = g.pieces[0][pieceIdx];
        require(pos != FINISHED_POS, "already home");
        require(pos != AT_BASE || g.lastDice == 6, "need 6 to leave base");
        uint8 newPos = pos == AT_BASE ? 1 : pos + g.lastDice;
        require(!(pos > BOARD_SIZE && newPos > FINISHED_POS), "overshoot");
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

    function getGame(uint256 gameId) external view returns (
        address player,
        uint8[4][4] memory pieces,
        uint8 aiCount,
        uint8 currentSeat,
        uint8 lastDice,
        bool diceRolled,
        uint8 state,
        uint256 wager,
        address winner
    ) {
        Game storage g = games[gameId];
        return (g.player, g.pieces, g.aiCount, g.currentSeat, g.lastDice, g.diceRolled, uint8(g.state), g.wager, g.winner);
    }

    function getPlayerGames(address p) external view returns (uint256[] memory) {
        return playerGames[p];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function withdrawPlatformFee(address to) external onlyOwner {
        uint256 amount = platformFeeBalance;
        platformFeeBalance = 0;
        usdm.transfer(to, amount);
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

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            if (g.pieces[seat][p] != FINISHED_POS) return false;
        }
        return true;
    }

    function _aiPickPiece(Game storage g, uint8 seat, uint8 dice) internal view returns (uint8) {
        uint8 best = type(uint8).max;
        uint8 bestScore = 0;
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
                        if (ppos >= 1 && ppos <= BOARD_SIZE && _globalPos(0, ppos) == myGlobal) {
                            score = 200;
                        }
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
        uint8 maxIter = 20;
        uint8 iter = 0;
        while (g.state == GameState.ACTIVE && iter < maxIter) {
            iter++;
            uint8 seat = g.currentSeat == 0 ? 1 : g.currentSeat;
            if (seat >= totalSeats) { g.currentSeat = 0; break; }
            g.currentSeat = seat;
            uint8 dice = _rollDiceFor(gameId, seat);
            if (!_hasValidMove(g, seat, dice)) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 pick = _aiPickPiece(g, seat, dice);
            if (pick == type(uint8).max) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 from = g.pieces[seat][pick];
            uint8 newPos = from == AT_BASE ? 1 : from + dice;
            _applyMove(gameId, seat, pick, newPos);
            emit PieceMoved(gameId, seat, pick, from, newPos);
            if (_isAllFinished(g, seat)) {
                _endGame(gameId, address(0));
                return;
            }
            g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
            if (g.currentSeat == 0) break;
        }
    }

    function _endGame(uint256 gameId, address winner) internal {
        Game storage g = games[gameId];
        g.state = GameState.FINISHED;
        g.winner = winner;
        uint256 prize = 0;
        if (g.wager > 0) {
            if (winner == g.player) {
                prize = (g.wager * 99) / 100;
                platformFeeBalance += (g.wager * 5) / 1000;
                weeklyPrizePool += g.wager - prize - (g.wager * 5) / 1000;
                usdm.transfer(winner, prize);
            } else {
                weeklyPrizePool += g.wager;
            }
        }
        if (winner == g.player) {
            totalWins[g.player]++;
        }
        emit GameFinished(gameId, winner, prize);
    }

    function _rollDiceFor(uint256 gameId, uint8 seat) internal returns (uint8) {
        Game storage g = games[gameId];
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, seat, g.nonce))) % 6) + 1;
        emit DiceRolled(gameId, seat, dice);
        return dice;
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
        for (uint8 i = 0; i < 8; i++) {
            if (SAFE_SQUARES[i] == globalPos) return true;
        }
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
            if (!_isSafe(myGlobal)) {
                _capture(gameId, seat, myGlobal);
            }
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
SOLEOF
commit "Padi.sol: add admin functions — withdrawPlatformFee, addToPrizePool, distributePrize"

# ─── Commit 22: emergencyRefund ───────────────────────────────────────────────
# Insert emergencyRefund after distributePrize
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Padi — on-chain Ludo vs AI on Celo
/// @notice Single-player game against 1-3 AI opponents. All game logic executes on-chain.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint8 public constant BOARD_SIZE = 52;
    uint8 public constant HOME_STRETCH = 6;
    uint8 public constant FINISHED_POS = 59;
    uint8 public constant AT_BASE = 0;
    uint8 public constant PIECES = 4;

    enum GameState { ACTIVE, FINISHED }

    struct Game {
        address player;
        uint8[4][4] pieces;
        uint8 aiCount;
        uint8 currentSeat;
        uint8 lastDice;
        bool diceRolled;
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
        g.player = msg.sender;
        g.aiCount = aiCount;
        g.wager = wagerAmount;
        g.state = GameState.ACTIVE;
        for (uint8 s = 0; s < 4; s++) {
            for (uint8 p = 0; p < 4; p++) {
                g.pieces[s][p] = AT_BASE;
            }
        }
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }

    function rollDice(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender, "not player");
        require(g.currentSeat == 0, "not your turn");
        require(!g.diceRolled, "already rolled");
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, g.nonce))) % 6) + 1;
        g.lastDice = dice;
        g.diceRolled = true;
        emit DiceRolled(gameId, 0, dice);
    }

    function movePiece(uint256 gameId, uint8 pieceIdx) external nonReentrant {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender, "not player");
        require(g.currentSeat == 0, "not your turn");
        require(g.diceRolled, "roll first");
        require(pieceIdx < PIECES, "bad piece");
        uint8 pos = g.pieces[0][pieceIdx];
        require(pos != FINISHED_POS, "already home");
        require(pos != AT_BASE || g.lastDice == 6, "need 6 to leave base");
        uint8 newPos = pos == AT_BASE ? 1 : pos + g.lastDice;
        require(!(pos > BOARD_SIZE && newPos > FINISHED_POS), "overshoot");
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

    function getGame(uint256 gameId) external view returns (
        address player,
        uint8[4][4] memory pieces,
        uint8 aiCount,
        uint8 currentSeat,
        uint8 lastDice,
        bool diceRolled,
        uint8 state,
        uint256 wager,
        address winner
    ) {
        Game storage g = games[gameId];
        return (g.player, g.pieces, g.aiCount, g.currentSeat, g.lastDice, g.diceRolled, uint8(g.state), g.wager, g.winner);
    }

    function getPlayerGames(address p) external view returns (uint256[] memory) {
        return playerGames[p];
    }

    function totalGames() external view returns (uint256) {
        return _gameCounter;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function withdrawPlatformFee(address to) external onlyOwner {
        uint256 amount = platformFeeBalance;
        platformFeeBalance = 0;
        usdm.transfer(to, amount);
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

    /// @notice Refund a stuck active game's wager back to the player.
    function emergencyRefund(uint256 gameId) external onlyOwner {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.wager > 0, "no wager");
        g.state = GameState.FINISHED;
        usdm.transfer(g.player, g.wager);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            if (g.pieces[seat][p] != FINISHED_POS) return false;
        }
        return true;
    }

    function _aiPickPiece(Game storage g, uint8 seat, uint8 dice) internal view returns (uint8) {
        uint8 best = type(uint8).max;
        uint8 bestScore = 0;
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
                        if (ppos >= 1 && ppos <= BOARD_SIZE && _globalPos(0, ppos) == myGlobal) {
                            score = 200;
                        }
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
        uint8 maxIter = 20;
        uint8 iter = 0;
        while (g.state == GameState.ACTIVE && iter < maxIter) {
            iter++;
            uint8 seat = g.currentSeat == 0 ? 1 : g.currentSeat;
            if (seat >= totalSeats) { g.currentSeat = 0; break; }
            g.currentSeat = seat;
            uint8 dice = _rollDiceFor(gameId, seat);
            if (!_hasValidMove(g, seat, dice)) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 pick = _aiPickPiece(g, seat, dice);
            if (pick == type(uint8).max) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 from = g.pieces[seat][pick];
            uint8 newPos = from == AT_BASE ? 1 : from + dice;
            _applyMove(gameId, seat, pick, newPos);
            emit PieceMoved(gameId, seat, pick, from, newPos);
            if (_isAllFinished(g, seat)) {
                _endGame(gameId, address(0));
                return;
            }
            g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
            if (g.currentSeat == 0) break;
        }
    }

    function _endGame(uint256 gameId, address winner) internal {
        Game storage g = games[gameId];
        g.state = GameState.FINISHED;
        g.winner = winner;
        uint256 prize = 0;
        if (g.wager > 0) {
            if (winner == g.player) {
                prize = (g.wager * 99) / 100;
                platformFeeBalance += (g.wager * 5) / 1000;
                weeklyPrizePool += g.wager - prize - (g.wager * 5) / 1000;
                usdm.transfer(winner, prize);
            } else {
                weeklyPrizePool += g.wager;
            }
        }
        if (winner == g.player) {
            totalWins[g.player]++;
        }
        emit GameFinished(gameId, winner, prize);
    }

    function _rollDiceFor(uint256 gameId, uint8 seat) internal returns (uint8) {
        Game storage g = games[gameId];
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, seat, g.nonce))) % 6) + 1;
        emit DiceRolled(gameId, seat, dice);
        return dice;
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
        for (uint8 i = 0; i < 8; i++) {
            if (SAFE_SQUARES[i] == globalPos) return true;
        }
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
            if (!_isSafe(myGlobal)) {
                _capture(gameId, seat, myGlobal);
            }
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
SOLEOF
commit "Padi.sol: add emergencyRefund and totalGames view — complete contract"

# ─── Commit 23: update deploy.ts ──────────────────────────────────────────────
cat > contracts/scripts/deploy.ts << 'TSEOF'
import { ethers } from "hardhat";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Padi with account:", deployer.address);

  const Padi = await ethers.getContractFactory("Padi");
  const padi = await Padi.deploy(USDM_ADDRESS);
  await padi.waitForDeployment();

  const address = await padi.getAddress();
  console.log("Padi deployed to:", address);
  console.log("Update PADI_ADDRESS in frontend/lib/contracts.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
TSEOF
commit "contracts: update deploy.ts with USDM address and deployment instructions"

# ─── Commit 24: frontend wagmi mainnet RPC ────────────────────────────────────
cat > frontend/lib/wagmi.ts << 'TSEOF'
import { createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Celo mainnet only — MiniPay runs on mainnet
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: false,
});
TSEOF
commit "wagmi.ts: enforce mainnet-only config, add ssr:false for MiniPay"

# ─── Commit 25: add .env.example for frontend ─────────────────────────────────
cat > frontend/.env.example << 'ENVEOF'
# Copy to .env.local and fill in after deploying the contract
NEXT_PUBLIC_PADI_ADDRESS=0x
ENVEOF
commit "frontend: add .env.example for post-deploy contract address"

# ─── Commit 26: update PADI_ADDRESS placeholder comment ──────────────────────
cat > frontend/lib/contracts.ts << 'TSEOF'
// USDM on Celo mainnet — same address as legacy cUSD, rebranded
export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

// Fill in after deploying Padi.sol to Celo mainnet
export const PADI_ADDRESS = "" as `0x${string}`;

export const PADI_ABI = [
  {
    name: "createGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "aiCount", type: "uint8" },
      { name: "wagerAmount", type: "uint256" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    name: "rollDice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "movePiece",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "pieceIdx", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "pieces", type: "uint8[4][4]" },
      { name: "aiCount", type: "uint8" },
      { name: "currentSeat", type: "uint8" },
      { name: "lastDice", type: "uint8" },
      { name: "diceRolled", type: "bool" },
      { name: "state", type: "uint8" },
      { name: "wager", type: "uint256" },
      { name: "winner", type: "address" },
    ],
  },
  {
    name: "getPlayerGames",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "p", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "totalWins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "weeklyPrizePool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalGames",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "aiCount", type: "uint8", indexed: false },
    ],
  },
  {
    name: "DiceRolled",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
      { name: "dice", type: "uint8", indexed: false },
    ],
  },
  {
    name: "PieceMoved",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
      { name: "piece", type: "uint8", indexed: false },
      { name: "from", type: "uint8", indexed: false },
      { name: "to", type: "uint8", indexed: false },
    ],
  },
  {
    name: "GameFinished",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
] as const;

// Minimal ERC-20 ABI for USDM approve
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
TSEOF
commit "contracts.ts: expand PADI_ABI with full typed entries and totalGames"

# ─── Commit 27: ludo.ts — add BOARD_PATH export ───────────────────────────────
cat > frontend/lib/ludo.ts << 'TSEOF'
export const PLAYER_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"] as const;
export const PLAYER_NAMES = ["Red", "Green", "Blue", "Yellow"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;

// Board path: [col, row] for each of the 52 main path squares (0-indexed)
export const BOARD_PATH: [number, number][] = [
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7],
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
];

export function boardSquareCoords(pos: number): [number, number] {
  return BOARD_PATH[pos % 52] || [7, 7];
}

export function homeStretchCoords(player: number, step: number): [number, number] {
  const stretches: [number, number][][] = [
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],   // Red (P0)
    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],        // Green (P1)
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],        // Blue (P2)
    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],    // Yellow (P3)
  ];
  return stretches[player]?.[step - 1] || [7, 7];
}

export function yardCoords(player: number, piece: number): [number, number] {
  const yards: [number, number][][] = [
    [[1,13],[3,13],[1,11],[3,11]],
    [[1,1],[3,1],[1,3],[3,3]],
    [[11,1],[13,1],[11,3],[13,3]],
    [[11,11],[13,11],[11,13],[13,13]],
  ];
  return yards[player]?.[piece] || [7, 7];
}

// Convert player-relative position to global board square index (0-51)
export function getGlobalPos(player: number, relPos: number): number {
  if (relPos === 0) return -1; // at base
  if (relPos > 52) return -2; // in home stretch or finished
  const startOffsets = [0, 13, 26, 39];
  return (startOffsets[player] + relPos - 1) % 52;
}

export function getPositionType(pos: number): "base" | "board" | "stretch" | "home" {
  if (pos === 0) return "base";
  if (pos <= 52) return "board";
  if (pos <= 58) return "stretch";
  return "home";
}

export const SAFE_SQUARES_GLOBAL = [0, 8, 13, 21, 26, 34, 39, 47];

export function isSafeSquare(globalPos: number): boolean {
  return SAFE_SQUARES_GLOBAL.includes(globalPos);
}

export function getPositionLabel(pos: number): string {
  if (pos === 0) return "Base";
  if (pos === 59) return "Home";
  if (pos > 52) return `H${pos - 52}`;
  return String(pos);
}

// Heuristic AI move picker (used in frontend preview only — actual AI is on-chain)
export function getAIMove(pieces: number[], dice: number): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < 4; i++) {
    const pos = pieces[i];
    if (pos === 59) continue;
    if (pos === 0 && dice !== 6) continue;
    const newPos = pos === 0 ? 1 : pos + dice;
    if (pos > 52 && newPos > 59) continue;
    if (pos <= 52 && newPos > 52 && (newPos - 52) > 6) continue;
    const score = pos === 0 ? 1 : pos;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
TSEOF
commit "ludo.ts: export BOARD_PATH constant, add getPositionLabel helper"

# ─── Commit 28: providers.tsx: add AutoConnect for MiniPay ───────────────────
cat > frontend/app/providers.tsx << 'TSEOF'
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnect } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 10_000 } },
});

// MiniPay auto-injects window.ethereum — connect on mount without any button
function AutoConnect() {
  const { connect, connectors } = useConnect();
  useEffect(() => {
    if (connectors[0]) connect({ connector: connectors[0] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoConnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
TSEOF
commit "providers.tsx: explicit AutoConnect comment, add react-query retry config"

# ─── Commit 29: page.tsx: add wallet address display ─────────────────────────
cat > frontend/app/page.tsx << 'TSEOF'
"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type View = "lobby" | "game" | "leaderboard";

export default function Home() {
  const { isConnected, address } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [activeGameId, setActiveGameId] = useState<bigint | null>(null);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-5xl">🎲</div>
        <h1 className="text-2xl font-bold text-red-400">Padi</h1>
        <p className="text-gray-400 text-sm">Opening in MiniPay...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-8">
      <header className="pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-red-400">🎲 Padi</h1>
          <p className="text-xs text-gray-500">Ludo vs AI · Celo</p>
        </div>
        <div className="flex items-center gap-2">
          {address && (
            <span className="text-[10px] text-gray-600 font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          )}
          <button
            onClick={() => setView(v => v === "leaderboard" ? "lobby" : "leaderboard")}
            className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg">
            {view === "leaderboard" ? "← Back" : "Leaderboard"}
          </button>
        </div>
      </header>

      <nav className="flex bg-gray-900 rounded-xl p-1 mb-4 gap-1">
        {([["lobby", "🏠 Lobby"], ["game", "🎮 My Game"]] as [View, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${view === id ? "bg-red-600 text-white" : "text-gray-400"}`}>
            {label}
          </button>
        ))}
      </nav>

      {view === "lobby" && <Lobby onEnterGame={(id) => { setActiveGameId(id); setView("game"); }} />}
      {view === "game" && <GameBoard gameId={activeGameId} onBack={() => setView("lobby")} />}
      {view === "leaderboard" && <Leaderboard />}
    </div>
  );
}
TSEOF
commit "page.tsx: display wallet address in header, update subtitle to Celo branding"

# ─── Commit 30: Lobby.tsx — add loading state ─────────────────────────────────
cat > frontend/components/Lobby.tsx << 'TSEOF'
"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

export default function Lobby({ onEnterGame }: { onEnterGame: (gameId: bigint) => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [aiCount, setAiCount] = useState(1);
  const [wager, setWager] = useState("0");
  const [status, setStatus] = useState<string | null>(null);

  const { data: prizePool } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool",
  });
  const { data: myGames } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getPlayerGames",
    args: address ? [address] : undefined,
  });
  const { data: wins } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalWins",
    args: address ? [address] : undefined,
  });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: create, data: createTx } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk, isLoading: creating, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const wagerBN = wager && Number(wager) > 0 ? parseUnits(wager, 18) : 0n;
  const busy = approving || creating;

  function handleCreate() {
    if (wagerBN > 0n) {
      setStatus("Approving USDM...");
      approve({
        address: USDM_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contract, wagerBN],
      });
    } else {
      setStatus("Creating game...");
      create({
        address: contract, abi: PADI_ABI, functionName: "createGame",
        args: [aiCount, 0n],
      });
    }
  }

  if (approveOk && !createTx) {
    setStatus("Creating game...");
    create({
      address: contract, abi: PADI_ABI, functionName: "createGame",
      args: [aiCount, wagerBN],
    });
  }

  if (createOk && createReceipt) {
    const log = createReceipt.logs[0];
    if (log) {
      try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /* */ }
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Weekly Pool</p>
          <p className="text-xl font-bold text-yellow-400">
            {prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "0.00"} USDM
          </p>
        </div>
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Your Wins</p>
          <p className="text-xl font-bold text-red-400">{wins?.toString() ?? "0"}</p>
        </div>
      </div>

      {/* Game creation */}
      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-white">New Game vs AI</p>

        <div>
          <p className="text-xs text-gray-400 mb-2">Number of AI opponents</p>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setAiCount(n)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                  aiCount === n
                    ? "border-red-500 bg-red-900/40 text-red-400"
                    : "border-gray-700 text-gray-400"
                }`}>
                {n} AI
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Optional wager (USDM)</p>
          <input
            value={wager}
            onChange={e => setWager(e.target.value)}
            placeholder="0 = free to play"
            type="number"
            min="0"
            step="0.1"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Win back 99% of your wager if you beat all AI. 0.5% goes to the prize pool.
          </p>
        </div>

        {status && <p className="text-xs text-yellow-400">{status}</p>}

        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold transition-colors">
          {busy ? (status ?? "Working...") : "🎲 Start Game"}
        </button>
      </div>

      {/* Continue a game */}
      {myGames && myGames.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-3">Continue a Game</p>
          <div className="flex flex-wrap gap-2">
            {[...myGames].reverse().slice(0, 6).map((id) => (
              <button key={id.toString()} onClick={() => onEnterGame(id)}
                className="px-3 py-1.5 bg-gray-800 text-sm text-gray-300 rounded-lg hover:bg-gray-700">
                Game #{id.toString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
TSEOF
commit "Lobby.tsx: add loading/status feedback, disable button while tx pending"

# ─── Commit 31: Lobby.tsx — add wager input step and validation ───────────────
cat > frontend/components/Lobby.tsx << 'TSEOF'
"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

const MIN_WAGER = 0.01; // USDM

export default function Lobby({ onEnterGame }: { onEnterGame: (gameId: bigint) => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [aiCount, setAiCount] = useState(1);
  const [wager, setWager] = useState("");
  const [wagerError, setWagerError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const { data: prizePool } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool",
  });
  const { data: myGames } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getPlayerGames",
    args: address ? [address] : undefined,
  });
  const { data: wins } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalWins",
    args: address ? [address] : undefined,
  });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: create, data: createTx } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk, isLoading: creating, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const wagerNum = parseFloat(wager) || 0;
  const wagerBN = wagerNum > 0 ? parseUnits(wagerNum.toFixed(18), 18) : 0n;
  const busy = approving || creating;

  function validateWager(val: string) {
    const n = parseFloat(val);
    if (val && (isNaN(n) || n < 0)) {
      setWagerError("Enter a valid amount");
    } else if (n > 0 && n < MIN_WAGER) {
      setWagerError(`Minimum wager is ${MIN_WAGER} USDM`);
    } else {
      setWagerError(null);
    }
  }

  function handleCreate() {
    if (wagerError) return;
    if (wagerBN > 0n) {
      setStatus("Approving USDM...");
      approve({
        address: USDM_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contract, wagerBN],
      });
    } else {
      setStatus("Creating game...");
      create({
        address: contract, abi: PADI_ABI, functionName: "createGame",
        args: [aiCount, 0n],
      });
    }
  }

  if (approveOk && !createTx) {
    setStatus("Creating game...");
    create({
      address: contract, abi: PADI_ABI, functionName: "createGame",
      args: [aiCount, wagerBN],
    });
  }

  if (createOk && createReceipt) {
    const log = createReceipt.logs[0];
    if (log) {
      try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /* */ }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Weekly Pool</p>
          <p className="text-xl font-bold text-yellow-400">
            {prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "0.00"} USDM
          </p>
        </div>
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Your Wins</p>
          <p className="text-xl font-bold text-red-400">{wins?.toString() ?? "0"}</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-white">New Game vs AI</p>

        <div>
          <p className="text-xs text-gray-400 mb-2">Number of AI opponents</p>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setAiCount(n)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                  aiCount === n
                    ? "border-red-500 bg-red-900/40 text-red-400"
                    : "border-gray-700 text-gray-400"
                }`}>
                {n} AI
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Optional wager (USDM)</p>
          <input
            value={wager}
            onChange={e => { setWager(e.target.value); validateWager(e.target.value); }}
            placeholder="0 = free to play"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={`w-full bg-gray-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 ${
              wagerError ? "border-red-500" : "border-gray-700"
            }`}
          />
          {wagerError
            ? <p className="text-xs text-red-400 mt-1">{wagerError}</p>
            : <p className="text-xs text-gray-600 mt-1">Win back 99% of wager if you beat all AI</p>
          }
        </div>

        {status && <p className="text-xs text-yellow-400 animate-pulse">{status}</p>}

        <button
          onClick={handleCreate}
          disabled={busy || !!wagerError}
          className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold transition-colors">
          {busy ? (status ?? "Working...") : "🎲 Start Game"}
        </button>
      </div>

      {myGames && myGames.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-3">Continue a Game</p>
          <div className="flex flex-wrap gap-2">
            {[...myGames].reverse().slice(0, 6).map((id) => (
              <button key={id.toString()} onClick={() => onEnterGame(id)}
                className="px-3 py-1.5 bg-gray-800 text-sm text-gray-300 rounded-lg hover:bg-gray-700">
                Game #{id.toString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
TSEOF
commit "Lobby.tsx: add wager validation with MIN_WAGER guard and inputMode=decimal"

# ─── Commit 32: GameBoard.tsx — add game ID display ──────────────────────────
cat > frontend/components/GameBoard.tsx << 'TSEOF'
"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";
import { boardSquareCoords, homeStretchCoords, PLAYER_COLORS } from "@/lib/ludo";

const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PIECE_BASE: Record<number, [number, number][]> = {
  0: [[1,1],[2,1],[1,2],[2,2]],
  1: [[12,1],[13,1],[12,2],[13,2]],
  2: [[1,12],[2,12],[1,13],[2,13]],
  3: [[12,12],[13,12],[12,13],[13,13]],
};

const SEAT_LABELS = ["You", "AI 1", "AI 2", "AI 3"];

export default function GameBoard({ gameId, onBack }: { gameId: bigint | null; onBack: () => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: game, refetch } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getGame",
    args: gameId !== null ? [gameId] : undefined,
    query: { refetchInterval: 3000 },
  });

  const { writeContract: roll } = useWriteContract();
  const { writeContract: move } = useWriteContract();

  if (!gameId) return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-sm">No active game.</p>
      <button onClick={onBack} className="mt-3 text-red-400 text-sm">← Go to Lobby</button>
    </div>
  );

  if (!game) return <div className="text-center py-12 text-gray-500 text-sm">Loading game...</div>;

  const [, pieces, aiCount, currentSeat, lastDice, diceRolled, state, wager, winner] = game as [
    `0x${string}`,
    readonly (readonly number[])[],
    number, number, number, boolean, number, bigint, `0x${string}`
  ];

  const isMyTurn = currentSeat === 0 && state === 0;
  const canRoll = isMyTurn && !diceRolled;
  const canMove = isMyTurn && diceRolled;
  const totalSeats = 1 + aiCount;

  type Cell = { seat: number; pieceIdx: number };
  const grid: (Cell | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null));

  for (let s = 0; s < totalSeats; s++) {
    for (let i = 0; i < 4; i++) {
      const pos = Number(pieces[s]?.[i] ?? 0);
      if (pos === 0) {
        const [col, row] = PIECE_BASE[s]?.[i] ?? [7, 7];
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 1 && pos <= 52) {
        const [col, row] = boardSquareCoords(pos - 1);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 53 && pos <= 58) {
        const [col, row] = homeStretchCoords(s, pos - 52);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      }
    }
  }

  function doRoll() {
    roll({ address: contract, abi: PADI_ABI, functionName: "rollDice", args: [gameId!] });
    setTimeout(() => refetch(), 2000);
  }

  function doMove(pieceIdx: number) {
    move({ address: contract, abi: PADI_ABI, functionName: "movePiece", args: [gameId!, pieceIdx] });
    setTimeout(() => refetch(), 3000);
  }

  const statusMsg = state === 1
    ? winner && winner !== "0x0000000000000000000000000000000000000000"
      ? winner.toLowerCase() === address?.toLowerCase() ? "You won!" : "AI won"
      : "Game Over"
    : isMyTurn
    ? canRoll ? "Your turn — roll the dice!" : `Rolled ${lastDice} — pick a piece`
    : `AI ${currentSeat} is thinking...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">← Back</button>
        <span className="text-xs text-gray-600 font-mono">Game #{gameId.toString()}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-white">{statusMsg}</p>
        {wager > 0n && <p className="text-xs text-yellow-400">🏆 {(Number(wager) / 1e18).toFixed(2)} USDM</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: totalSeats }, (_, s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[s] }} />
            <span className={s === currentSeat && state === 0 ? "text-white font-bold" : "text-gray-400"}>
              {SEAT_LABELS[s]}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", width: "100%", height: "100%", gap: "1px" }}>
          {Array.from({ length: 15 }, (_, row) =>
            Array.from({ length: 15 }, (_, col) => {
              const cell = grid[row][col];
              const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
              const inR = row <= 4 && col <= 4;
              const inG = row <= 4 && col >= 10;
              const inB = row >= 10 && col <= 4;
              const inY = row >= 10 && col >= 10;
              let bg = "bg-gray-800";
              if (isCenter) bg = "bg-gray-700";
              else if (inR) bg = "bg-red-950";
              else if (inG) bg = "bg-green-950";
              else if (inB) bg = "bg-blue-950";
              else if (inY) bg = "bg-yellow-950";

              const isSafe = (() => {
                for (let s = 1; s <= 52; s++) {
                  if (SAFE.has(s)) {
                    const [sc, sr] = boardSquareCoords(s - 1);
                    if (sc === col && sr === row) return true;
                  }
                }
                return false;
              })();

              return (
                <div key={`${row}-${col}`}
                  className={`${bg} flex items-center justify-center ${isSafe ? "ring-1 ring-inset ring-yellow-600/30" : ""}`}>
                  {cell && (
                    <button
                      onClick={() => canMove && cell.seat === 0 && doMove(cell.pieceIdx)}
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: PLAYER_COLORS[cell.seat] + "cc" }}>
                      <span className="text-[6px] font-bold text-white">{cell.pieceIdx + 1}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{lastDice || "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">dice</p>
        </div>
        <button onClick={doRoll} disabled={!canRoll}
          className={`flex-1 rounded-xl font-bold text-sm transition-all ${canRoll ? "bg-red-600 hover:bg-red-500 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
          {canRoll ? "🎲 Roll" : currentSeat !== 0 ? "AI moving..." : "Pick piece"}
        </button>
      </div>

      {canMove && (
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-2">Your pieces — tap to move</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => {
              const pos = Number(pieces[0]?.[i] ?? 0);
              const canMovePiece = pos !== 59 && (pos !== 0 || lastDice === 6);
              return (
                <button key={i} onClick={() => canMovePiece && doMove(i)}
                  disabled={!canMovePiece}
                  className={`py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
                    canMovePiece ? "bg-red-700 hover:bg-red-600" : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}>
                  {pos === 0 ? "⌂" : pos === 59 ? "✓" : pos}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state === 1 && (
        <div className={`rounded-xl p-4 text-center border ${
          winner && winner !== "0x0000000000000000000000000000000000000000" && winner.toLowerCase() === address?.toLowerCase()
            ? "bg-green-900/30 border-green-600"
            : "bg-gray-900 border-gray-700"
        }`}>
          <p className="font-bold text-lg">
            {winner && winner !== "0x0000000000000000000000000000000000000000"
              ? winner.toLowerCase() === address?.toLowerCase() ? "You won! 🎉" : "AI won this time"
              : "Game Over"}
          </p>
          {wager > 0n && winner?.toLowerCase() === address?.toLowerCase() && (
            <p className="text-green-400 text-sm mt-1">
              {(Number(wager) * 0.99 / 1e18).toFixed(4)} USDM returned to your wallet
            </p>
          )}
          <button onClick={onBack} className="mt-3 text-sm text-gray-400 hover:text-white">
            Play again →
          </button>
        </div>
      )}
    </div>
  );
}
TSEOF
commit "GameBoard.tsx: show game ID in header, highlight active seat, disable unmovable pieces"

# ─── Commit 33: GameBoard.tsx — fix boardSquareCoords indexing ────────────────
# pos=1 means board square index 0; was passing pos which is off-by-one
# Already fixed in commit 32 (pos-1 passed). Add comment to clarify.
cat > frontend/components/GameBoard.tsx << 'TSEOF'
"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";
import { boardSquareCoords, homeStretchCoords, PLAYER_COLORS } from "@/lib/ludo";

const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PIECE_BASE: Record<number, [number, number][]> = {
  0: [[1,1],[2,1],[1,2],[2,2]],
  1: [[12,1],[13,1],[12,2],[13,2]],
  2: [[1,12],[2,12],[1,13],[2,13]],
  3: [[12,12],[13,12],[12,13],[13,13]],
};

const SEAT_LABELS = ["You", "AI 1", "AI 2", "AI 3"];

export default function GameBoard({ gameId, onBack }: { gameId: bigint | null; onBack: () => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: game, refetch } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getGame",
    args: gameId !== null ? [gameId] : undefined,
    query: { refetchInterval: 3000 },
  });

  const { writeContract: roll } = useWriteContract();
  const { writeContract: move } = useWriteContract();

  if (!gameId) return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-sm">No active game.</p>
      <button onClick={onBack} className="mt-3 text-red-400 text-sm">← Go to Lobby</button>
    </div>
  );

  if (!game) return <div className="text-center py-12 text-gray-500 text-sm">Loading game...</div>;

  const [, pieces, aiCount, currentSeat, lastDice, diceRolled, state, wager, winner] = game as [
    `0x${string}`,
    readonly (readonly number[])[],
    number, number, number, boolean, number, bigint, `0x${string}`
  ];

  const isMyTurn = currentSeat === 0 && state === 0;
  const canRoll = isMyTurn && !diceRolled;
  const canMove = isMyTurn && diceRolled;
  const totalSeats = 1 + aiCount;

  type Cell = { seat: number; pieceIdx: number };
  const grid: (Cell | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null));

  for (let s = 0; s < totalSeats; s++) {
    for (let i = 0; i < 4; i++) {
      const pos = Number(pieces[s]?.[i] ?? 0);
      if (pos === 0) {
        const [col, row] = PIECE_BASE[s]?.[i] ?? [7, 7];
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 1 && pos <= 52) {
        // pos is 1-indexed (1=first square); BOARD_PATH is 0-indexed
        const [col, row] = boardSquareCoords(pos - 1);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 53 && pos <= 58) {
        // step = pos - 52; homeStretchCoords expects 1-indexed step
        const [col, row] = homeStretchCoords(s, pos - 52);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      }
    }
  }

  function doRoll() {
    roll({ address: contract, abi: PADI_ABI, functionName: "rollDice", args: [gameId!] });
    setTimeout(() => refetch(), 2000);
  }

  function doMove(pieceIdx: number) {
    move({ address: contract, abi: PADI_ABI, functionName: "movePiece", args: [gameId!, pieceIdx] });
    setTimeout(() => refetch(), 3000);
  }

  const statusMsg = state === 1
    ? winner && winner !== "0x0000000000000000000000000000000000000000"
      ? winner.toLowerCase() === address?.toLowerCase() ? "You won!" : "AI won"
      : "Game Over"
    : isMyTurn
    ? canRoll ? "Your turn — roll the dice!" : `Rolled ${lastDice} — pick a piece`
    : `AI ${currentSeat} is thinking...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">← Back</button>
        <span className="text-xs text-gray-600 font-mono">Game #{gameId.toString()}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-white">{statusMsg}</p>
        {wager > 0n && <p className="text-xs text-yellow-400">🏆 {(Number(wager) / 1e18).toFixed(2)} USDM</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: totalSeats }, (_, s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[s] }} />
            <span className={s === currentSeat && state === 0 ? "text-white font-bold" : "text-gray-400"}>
              {SEAT_LABELS[s]}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", width: "100%", height: "100%", gap: "1px" }}>
          {Array.from({ length: 15 }, (_, row) =>
            Array.from({ length: 15 }, (_, col) => {
              const cell = grid[row][col];
              const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
              const inR = row <= 4 && col <= 4;
              const inG = row <= 4 && col >= 10;
              const inB = row >= 10 && col <= 4;
              const inY = row >= 10 && col >= 10;
              let bg = "bg-gray-800";
              if (isCenter) bg = "bg-gray-700";
              else if (inR) bg = "bg-red-950";
              else if (inG) bg = "bg-green-950";
              else if (inB) bg = "bg-blue-950";
              else if (inY) bg = "bg-yellow-950";

              const isSafe = (() => {
                for (const sq of SAFE) {
                  if (sq === 0) continue;
                  const [sc, sr] = boardSquareCoords(sq - 1);
                  if (sc === col && sr === row) return true;
                }
                return false;
              })();

              return (
                <div key={`${row}-${col}`}
                  className={`${bg} flex items-center justify-center ${isSafe ? "ring-1 ring-inset ring-yellow-600/30" : ""}`}>
                  {cell && (
                    <button
                      onClick={() => canMove && cell.seat === 0 && doMove(cell.pieceIdx)}
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: PLAYER_COLORS[cell.seat] + "cc" }}>
                      <span className="text-[6px] font-bold text-white">{cell.pieceIdx + 1}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{lastDice || "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">dice</p>
        </div>
        <button onClick={doRoll} disabled={!canRoll}
          className={`flex-1 rounded-xl font-bold text-sm transition-all ${canRoll ? "bg-red-600 hover:bg-red-500 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
          {canRoll ? "🎲 Roll" : currentSeat !== 0 ? "AI moving..." : "Pick piece"}
        </button>
      </div>

      {canMove && (
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-2">Your pieces — tap to move</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => {
              const pos = Number(pieces[0]?.[i] ?? 0);
              const canMovePiece = pos !== 59 && (pos !== 0 || lastDice === 6);
              return (
                <button key={i} onClick={() => canMovePiece && doMove(i)}
                  disabled={!canMovePiece}
                  className={`py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
                    canMovePiece ? "bg-red-700 hover:bg-red-600" : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}>
                  {pos === 0 ? "⌂" : pos === 59 ? "✓" : pos}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state === 1 && (
        <div className={`rounded-xl p-4 text-center border ${
          winner && winner !== "0x0000000000000000000000000000000000000000" && winner.toLowerCase() === address?.toLowerCase()
            ? "bg-green-900/30 border-green-600"
            : "bg-gray-900 border-gray-700"
        }`}>
          <p className="font-bold text-lg">
            {winner && winner !== "0x0000000000000000000000000000000000000000"
              ? winner.toLowerCase() === address?.toLowerCase() ? "You won! 🎉" : "AI won this time"
              : "Game Over"}
          </p>
          {wager > 0n && winner?.toLowerCase() === address?.toLowerCase() && (
            <p className="text-green-400 text-sm mt-1">
              {(Number(wager) * 0.99 / 1e18).toFixed(4)} USDM returned to your wallet
            </p>
          )}
          <button onClick={onBack} className="mt-3 text-sm text-gray-400 hover:text-white">
            Play again →
          </button>
        </div>
      )}
    </div>
  );
}
TSEOF
commit "GameBoard.tsx: fix boardSquareCoords pos-1 indexing, clean up safe square loop"

echo "=== Part 2 done ==="
