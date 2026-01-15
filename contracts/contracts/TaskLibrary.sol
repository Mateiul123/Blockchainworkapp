// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITaskMarketplace.sol";

/**
 * @title TaskLibrary
 * @dev Library for task validation and utility functions
 * Demonstrates the Library Pattern
 */
library TaskLibrary {
    /**
     * @dev View function to validate task parameters
     */
    function validateTaskCreation(
        string calldata title,
        string calldata description,
        uint256 reward,
        uint256 deadline
    ) internal view returns (bool) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(title).length <= 100, "Title too long");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(description).length <= 1000, "Description too long");
        require(reward > 0, "Reward must be greater than 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        return true;
    }
    
    /**
     * @dev Pure function to check if task can be taken
     */
    function canTakeTask(
        ITaskMarketplace.TaskStatus status,
        address creator,
        address worker,
        address sender
    ) internal pure returns (bool) {
        require(status == ITaskMarketplace.TaskStatus.Open, "Task is not open");
        require(sender != creator, "Creator cannot take own task");
        require(worker == address(0), "Task already taken");
        return true;
    }
    
    /**
     * @dev Pure function to check if task can be completed
     */
    function canCompleteTask(
        ITaskMarketplace.TaskStatus status,
        address worker,
        address sender
    ) internal pure returns (bool) {
        require(status == ITaskMarketplace.TaskStatus.InProgress, "Task is not in progress");
        require(sender == worker, "Only assigned worker can complete task");
        return true;
    }
    
    /**
     * @dev Pure function to calculate platform fee
     */
    function calculatePlatformFee(uint256 reward) internal pure returns (uint256) {
        return (reward * 2) / 100; // 2% fee
    }
    
    /**
     * @dev Pure function to calculate worker payment
     */
    function calculateWorkerPayment(uint256 reward) internal pure returns (uint256) {
        uint256 fee = calculatePlatformFee(reward);
        return reward - fee;
    }
}
