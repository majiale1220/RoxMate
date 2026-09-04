// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {RoxMateRegistry} from "../src/RoxMateRegistry.sol";

contract DeployRoxMateRegistry is Script {
    function run() external returns (RoxMateRegistry registry) {
        vm.startBroadcast();
        registry = new RoxMateRegistry();
        vm.stopBroadcast();
    }
}
