#!/bin/bash
set -e

export GIT_AUTHOR_NAME="sanmipaul"
export GIT_AUTHOR_EMAIL="sanmipaul1@gmail.com"
export GIT_COMMITTER_NAME="sanmipaul"
export GIT_COMMITTER_EMAIL="sanmipaul1@gmail.com"

GIT="git"

commit() {
  $GIT add -A
  $GIT commit -m "$1"
}

# ─── Commit 7: state variables ────────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}
SOLEOF
commit "Padi.sol: add state variables, mappings, and prize pool tracking"

# ─── Commit 8: events ─────────────────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}
SOLEOF
commit "Padi.sol: add events (GameCreated, DiceRolled, PieceMoved, GameFinished)"

# ─── Commit 9: createGame skeleton ────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }

    /// @notice Start a new solo game vs 1-3 AI opponents.
    function createGame(uint8 aiCount, uint256 wagerAmount) external nonReentrant returns (uint256 gameId) {
        require(aiCount >= 1 && aiCount <= 3, "aiCount 1-3");
    }
}
SOLEOF
commit "Padi.sol: add createGame function signature with aiCount validation"

# ─── Commit 10: createGame wager logic ────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }

    function createGame(uint8 aiCount, uint256 wagerAmount) external nonReentrant returns (uint256 gameId) {
        require(aiCount >= 1 && aiCount <= 3, "aiCount 1-3");
        if (wagerAmount > 0) {
            require(usdm.transferFrom(msg.sender, address(this), wagerAmount), "transfer failed");
        }
        gameId = ++_gameCounter;
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }
}
SOLEOF
commit "Padi.sol: createGame — transfer wager on game creation"

# ─── Commit 11: createGame pieces init ────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
        // All pieces start at base (position 0)
        for (uint8 s = 0; s < 4; s++) {
            for (uint8 p = 0; p < 4; p++) {
                g.pieces[s][p] = AT_BASE;
            }
        }
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }
}
SOLEOF
commit "Padi.sol: createGame — initialize all pieces at base position"

# ─── Commit 12: rollDice function ─────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    function _rollDiceFor(uint256 gameId, uint8 seat) internal returns (uint8) {
        Game storage g = games[gameId];
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, seat, g.nonce))) % 6) + 1;
        emit DiceRolled(gameId, seat, dice);
        return dice;
    }
}
SOLEOF
commit "Padi.sol: add rollDice and _rollDiceFor using prevrandao"

# ─── Commit 13: _hasValidMove helper ──────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue; // overshoot
            return true;
        }
        return false;
    }
}
SOLEOF
commit "Padi.sol: add _hasValidMove — check if a seat can make any move"

# ─── Commit 14: movePiece function ────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
        _runAITurns(gameId);
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

    function _applyMove(uint256 gameId, uint8 seat, uint8 pieceIdx, uint8 newPos) internal {
        games[gameId].pieces[seat][pieceIdx] = newPos;
    }

    function _runAITurns(uint256 gameId) internal {}
}
SOLEOF
commit "Padi.sol: add movePiece with validation and delegate to _applyMove"

# ─── Commit 15: _applyMove with capture logic ─────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
        _runAITurns(gameId);
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
        // Only capture on main board squares
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

    function _runAITurns(uint256 gameId) internal {}
}
SOLEOF
commit "Padi.sol: implement _applyMove with capture logic and safe squares"

# ─── Commit 16: _isAllFinished helper ─────────────────────────────────────────
cat >> contracts/contracts/Padi.sol << 'APPENDEOF'
APPENDEOF
# Just write a new version with the helper added
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            if (g.pieces[seat][p] != FINISHED_POS) return false;
        }
        return true;
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

    function _endGame(uint256 gameId, address winner) internal {}
    function _runAITurns(uint256 gameId) internal {}
}
SOLEOF
commit "Padi.sol: add _isAllFinished and check win after player moves"

# ─── Commit 17: _aiPickPiece ──────────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            if (g.pieces[seat][p] != FINISHED_POS) return false;
        }
        return true;
    }

    /// @dev Greedy AI: prefer capturing, then entering board, then advancing most-progressed piece.
    function _aiPickPiece(Game storage g, uint8 seat, uint8 dice) internal view returns (uint8) {
        uint8 best = type(uint8).max;
        uint8 bestScore = 0;
        for (uint8 p = 0; p < PIECES; p++) {
            uint8 pos = g.pieces[seat][p];
            if (pos == FINISHED_POS) continue;
            if (pos == AT_BASE && dice != 6) continue;
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue;
            uint8 score = pos == AT_BASE ? 50 : pos; // prefer advancing further pieces
            // Check if this move captures a player piece
            if (newPos >= 1 && newPos <= BOARD_SIZE) {
                uint8 myGlobal = _globalPos(seat, newPos);
                if (!_isSafe(myGlobal)) {
                    for (uint8 sp = 0; sp < PIECES; sp++) {
                        uint8 ppos = g.pieces[0][sp];
                        if (ppos >= 1 && ppos <= BOARD_SIZE && _globalPos(0, ppos) == myGlobal) {
                            score = 200; // capture is highest priority
                        }
                    }
                }
            }
            if (score > bestScore) { bestScore = score; best = p; }
        }
        return best;
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

    function _endGame(uint256 gameId, address winner) internal {}
    function _runAITurns(uint256 gameId) internal {}
}
SOLEOF
commit "Padi.sol: add _aiPickPiece with greedy capture-first strategy"

# ─── Commit 18: _runAITurns ───────────────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    /// @dev Execute AI turns for all AI seats in the same transaction as the human move.
    function _runAITurns(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 totalSeats = 1 + g.aiCount;
        uint8 maxIter = 20;
        uint8 iter = 0;
        // Advance through seats 1..aiCount, giving each a turn
        while (g.state == GameState.ACTIVE && iter < maxIter) {
            iter++;
            uint8 seat = g.currentSeat == 0 ? 1 : g.currentSeat;
            if (seat >= totalSeats) { g.currentSeat = 0; break; }
            g.currentSeat = seat;
            uint8 dice = _rollDiceFor(gameId, seat);
            if (!_hasValidMove(g, seat, dice)) {
                // Skip turn
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
                _endGame(gameId, address(0)); // AI won
                return;
            }
            // Move to next seat, wrap to 0 (player) after last AI
            g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
            if (g.currentSeat == 0) break;
        }
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

    function _endGame(uint256 gameId, address winner) internal {}
}
SOLEOF
commit "Padi.sol: implement _runAITurns — AI plays all seats in same tx as player"

# ─── Commit 19: _endGame with prize ───────────────────────────────────────────
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    /// @dev Settle the game: pay out wager to winner (or forfeit to prize pool if AI wins).
    function _endGame(uint256 gameId, address winner) internal {
        Game storage g = games[gameId];
        g.state = GameState.FINISHED;
        g.winner = winner;
        uint256 prize = 0;
        if (g.wager > 0) {
            if (winner == g.player) {
                // Player wins: return 99%, 0.5% to platform, 0.5% to weekly pool
                prize = (g.wager * 99) / 100;
                platformFeeBalance += (g.wager * 5) / 1000;
                weeklyPrizePool += g.wager - prize - (g.wager * 5) / 1000;
                usdm.transfer(winner, prize);
            } else {
                // AI wins: full wager to weekly prize pool
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
commit "Padi.sol: implement _endGame with wager settlement and prize pool contribution"

# ─── Commit 20: getGame view function ─────────────────────────────────────────
cat >> contracts/contracts/Padi.sol << 'APPENDEOF'

// Will be replaced — just appending marker for diff purposes
APPENDEOF
# Write full file with view functions
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
commit "Padi.sol: add getGame and getPlayerGames view functions"

echo "=== CONTRACT COMMITS DONE ==="
