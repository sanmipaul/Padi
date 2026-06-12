// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Padi — on-chain Ludo vs AI opponents on Celo.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}
