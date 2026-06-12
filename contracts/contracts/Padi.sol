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
