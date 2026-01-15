// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ITaskMarketplace
 * @dev Interface for the TaskMarketplace contract
 * Demonstrates advanced OOP with interfaces
 */
interface ITaskMarketplace {
    enum TaskStatus { Open, InProgress, PendingApproval, Completed, Cancelled }
    
    struct Task {
        uint256 id;
        address creator;
        address worker;
        string title;
        string description;
        uint256 reward;
        TaskStatus status;
        uint256 createdAt;
        uint256 deadline;
    }
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, uint256 deadline);
    event TaskTaken(uint256 indexed taskId, address indexed worker);
    event WorkSubmitted(uint256 indexed taskId, address indexed worker);
    event TaskApproved(uint256 indexed taskId, address indexed creator, address indexed worker, uint256 reward);
    event TaskCompleted(uint256 indexed taskId, address indexed worker, uint256 reward);
    event TaskCancelled(uint256 indexed taskId);
    
    function createTask(string calldata title, string calldata description, uint256 deadline) external payable returns (uint256);
    function takeTask(uint256 taskId) external;
    function submitWork(uint256 taskId) external;
    function approveWork(uint256 taskId) external;
    function completeTask(uint256 taskId) external;
    function cancelTask(uint256 taskId) external;
    function getTask(uint256 taskId) external view returns (Task memory);
    function getTasksByCreator(address creator) external view returns (uint256[] memory);
    function getTasksByWorker(address worker) external view returns (uint256[] memory);
}
