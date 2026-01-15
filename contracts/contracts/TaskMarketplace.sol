// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITaskMarketplace.sol";
import "./TaskLibrary.sol";

/**
 * @title TaskMarketplace
 * @dev A decentralized task marketplace where users can create and complete tasks for ETH rewards
 * 
 * Requirements covered:
 * - Mappings and address types (tasks, tasksByCreator, tasksByWorker)
 * - Events (TaskCreated, TaskTaken, TaskCompleted, TaskCancelled)
 * - Modifiers (onlyTaskCreator, taskExists, onlyOwner)
 * - Function types (external, public, internal, pure, view)
 * - ETH transfers (payable functions, transfer to workers)
 * - Interface implementation (ITaskMarketplace)
 * - Library usage (TaskLibrary)
 * - Contract interaction (can be extended with other contracts)
 */
contract TaskMarketplace is ITaskMarketplace {
    using TaskLibrary for *;
    
    // State variables demonstrating Solidity-specific types
    mapping(uint256 => Task) private tasks; // mapping: taskId => Task
    mapping(address => uint256[]) private tasksByCreator; // mapping: creator => taskIds
    mapping(address => uint256[]) private tasksByWorker; // mapping: worker => taskIds
    mapping(address => uint256) private userBalances; // Withdrawal pattern
    
    address public owner; // address type
    uint256 private taskCounter;
    uint256 public platformFeeBalance;
    
    // Modifier examples
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier taskExists(uint256 taskId) {
        require(taskId > 0 && taskId <= taskCounter, "Task does not exist");
        _;
    }
    
    modifier onlyTaskCreator(uint256 taskId) {
        require(tasks[taskId].creator == msg.sender, "Only task creator can call this");
        _;
    }
    
    modifier onlyWorker(uint256 taskId) {
        require(tasks[taskId].worker == msg.sender, "Only assigned worker can call this");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        taskCounter = 0;
    }
    
    /**
     * @dev External payable function to create a task with ETH reward
     * Demonstrates: external, payable, ETH transfers, events, library usage
     */
    function createTask(
        string calldata title,
        string calldata description,
        uint256 deadline
    ) external payable override returns (uint256) {
        // Using library for validation (pure function)
        TaskLibrary.validateTaskCreation(title, description, msg.value, deadline);
        
        taskCounter++;
        
        Task memory newTask = Task({
            id: taskCounter,
            creator: msg.sender,
            worker: address(0),
            title: title,
            description: description,
            reward: msg.value,
            status: TaskStatus.Open,
            createdAt: block.timestamp,
            deadline: deadline
        });
        
        tasks[taskCounter] = newTask;
        tasksByCreator[msg.sender].push(taskCounter);
        
        emit TaskCreated(taskCounter, msg.sender, msg.value, deadline);
        
        return taskCounter;
    }
    
    /**
     * @dev External function to take an available task
     * Demonstrates: external, state changes, events, library usage
     */
    function takeTask(uint256 taskId) external override taskExists(taskId) {
        Task storage task = tasks[taskId];
        
        // Using library for validation
        TaskLibrary.canTakeTask(
            task.status,
            task.creator,
            task.worker,
            msg.sender
        );
        
        require(block.timestamp < task.deadline, "Task deadline has passed");
        
        task.worker = msg.sender;
        task.status = TaskStatus.InProgress;
        tasksByWorker[msg.sender].push(taskId);
        
        emit TaskTaken(taskId, msg.sender);
    }
    
    /**
     * @dev External function to submit work for a task
     * Worker calls this when they've completed the work
     * Task goes to PendingApproval status
     */
    function submitWork(uint256 taskId) 
        external 
        override 
        taskExists(taskId) 
        onlyWorker(taskId) 
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "Task is not in progress");
        
        task.status = TaskStatus.PendingApproval;
        emit WorkSubmitted(taskId, msg.sender);
    }
    
    /**
     * @dev External function for task creator to approve completed work
     * Creator calls this to approve work and release payment to worker
     * Part 2: ETH transfers - worker receives the reward here
     */
    function approveWork(uint256 taskId) 
        external 
        override 
        taskExists(taskId) 
        onlyTaskCreator(taskId) 
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.PendingApproval, "Work has not been submitted");
        require(task.worker != address(0), "No worker assigned");
        
        task.status = TaskStatus.Completed;
        
        // Calculate payments using library (pure functions)
        uint256 platformFee = TaskLibrary.calculatePlatformFee(task.reward);
        uint256 workerPayment = TaskLibrary.calculateWorkerPayment(task.reward);
        
        platformFeeBalance += platformFee;
        
        // ETH transfer to worker (Withdrawal Pattern)
        userBalances[task.worker] += workerPayment;
        
        emit TaskApproved(taskId, task.creator, task.worker, workerPayment);
        emit TaskCompleted(taskId, task.worker, workerPayment);
    }
    
    /**
     * @dev External function to complete a task and transfer reward
     * DEPRECATED: Use submitWork() then approveWork() for escrow
     * Kept for backwards compatibility
     */
    function completeTask(uint256 taskId) 
        external 
        override 
        taskExists(taskId) 
        onlyWorker(taskId) 
    {
        Task storage task = tasks[taskId];
        
        require(task.status == TaskStatus.InProgress, "Task is not in progress");
        require(task.worker != address(0), "No worker assigned");
        
        // Submit work instead
        task.status = TaskStatus.PendingApproval;
        emit WorkSubmitted(taskId, msg.sender);
    }
    
    /**
     * @dev External function to cancel a task and refund creator
     * Demonstrates: external, ETH transfers, events, modifiers
     */
    function cancelTask(uint256 taskId) 
        external 
        override 
        taskExists(taskId) 
        onlyTaskCreator(taskId) 
    {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.Open || task.status == TaskStatus.InProgress,
            "Task cannot be cancelled"
        );
        
        task.status = TaskStatus.Cancelled;
        
        // Refund creator using Withdrawal Pattern
        userBalances[task.creator] += task.reward;
        
        emit TaskCancelled(taskId);
    }
    
    /**
     * @dev External view function to get task details
     * Demonstrates: external, view (read-only)
     */
    function getTask(uint256 taskId) 
        external 
        view 
        override 
        taskExists(taskId) 
        returns (Task memory) 
    {
        return tasks[taskId];
    }
    
    /**
     * @dev External view function to get all tasks by creator
     * Demonstrates: external, view
     */
    function getTasksByCreator(address creator) 
        external 
        view 
        override 
        returns (uint256[] memory) 
    {
        return tasksByCreator[creator];
    }
    
    /**
     * @dev External view function to get all tasks by worker
     * Demonstrates: external, view
     */
    function getTasksByWorker(address worker) 
        external 
        view 
        override 
        returns (uint256[] memory) 
    {
        return tasksByWorker[worker];
    }
    
    /**
     * @dev Public view function to get all open tasks
     * Demonstrates: public, view, array manipulation
     */
    function getAllOpenTasks() public view returns (Task[] memory) {
        uint256 openCount = 0;
        
        // Count open tasks
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].status == TaskStatus.Open) {
                openCount++;
            }
        }
        
        // Create array of open tasks
        Task[] memory openTasks = new Task[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].status == TaskStatus.Open) {
                openTasks[index] = tasks[i];
                index++;
            }
        }
        
        return openTasks;
    }
    
    /**
     * @dev External function to withdraw available balance (Withdrawal Pattern)
     * Demonstrates: external, ETH transfers, security pattern
     */
    function withdraw() external {
        uint256 amount = userBalances[msg.sender];
        require(amount > 0, "No balance to withdraw");
        
        userBalances[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev External view function to get user's withdrawable balance
     * Demonstrates: external, view
     */
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
    
    /**
     * @dev External function for owner to withdraw platform fees
     * Demonstrates: external, onlyOwner modifier, ETH transfers
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = platformFeeBalance;
        require(amount > 0, "No fees to withdraw");
        
        platformFeeBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Public pure function to get platform fee percentage
     * Demonstrates: public, pure (no state access)
     */
    function getPlatformFeePercentage() public pure returns (uint256) {
        return 2; // 2%
    }
    
    /**
     * @dev Public view function to get total number of tasks
     * Demonstrates: public, view
     */
    function getTotalTasks() public view returns (uint256) {
        return taskCounter;
    }
    
    /**
     * @dev Internal pure function example
     * Demonstrates: internal, pure
     */
    function _isValidAddress(address addr) internal pure returns (bool) {
        return addr != address(0);
    }
    
    /**
     * @dev Receive function to accept ETH
     * Demonstrates: special function, payable
     */
    receive() external payable {
        platformFeeBalance += msg.value;
    }
    
    /**
     * @dev Fallback function
     * Demonstrates: special function, payable
     */
    fallback() external payable {
        platformFeeBalance += msg.value;
    }
}
