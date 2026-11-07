// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Bountiful} from "../src/Bountiful.sol";

contract DeployScript is Script {
    function run() external returns (Bountiful bountiful) {
        vm.startBroadcast();

        bountiful = new Bountiful();
        console.log("Bountiful deployed at:", address(bountiful));

        vm.stopBroadcast();
    }
}
