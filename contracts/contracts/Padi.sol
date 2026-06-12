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
