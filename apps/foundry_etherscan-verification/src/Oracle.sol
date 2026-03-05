// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Oracle is Ownable {
    uint256 public by;

    constructor(address initialOwner) Ownable(initialOwner) {}

    event Updated(uint256 by);

    function set(uint256 _by) public onlyOwner {
        by = _by;
        emit Updated(_by);
    }
}
