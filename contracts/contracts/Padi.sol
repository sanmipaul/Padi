// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Padi — on-chain Ludo vs AI opponents on Celo.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint8 public constant BOARD_SIZE = 52;
    uint8 public constant HOME_STRETCH = 6;
    uint8 public constant FINISHED_POS = 59;
    uint8 public constant AT_BASE = 0;
    uint8 public constant PIECES = 4;

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}
