// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITaskMarketplace.sol";
import "./TaskLibrary.sol";

/**
 * @title TaskMarketplace V2
 * @dev Job/Task marketplace with applications, deadlines, escrow + auto-approval, comments (IPFS), ratings.
 */
contract TaskMarketplace is ITaskMarketplace {
    using TaskLibrary for *;

    // -------- Storage --------
    mapping(uint256 => Task) private tasks;
    mapping(address => uint256[]) private tasksByCreator;
    mapping(address => uint256[]) private tasksByWorker;

    // Applicants
    mapping(uint256 => address[]) private applicants;
    mapping(uint256 => mapping(address => bool)) private hasApplied;

    // Ratings
    mapping(address => RatingInfo) private ratings;
    mapping(uint256 => bool) private workerRated;
    mapping(uint256 => bool) private creatorRated;

    // Withdrawal pattern
    mapping(address => uint256) private userBalances;

    address public owner;
    uint256 private taskCounter;
    uint256 public platformFeeBalance;

    event TaskComment(
    uint256 indexed taskId,
    address indexed author,
    string message,
    uint256 timestamp
);


    // -------- Modifiers --------
    modifier taskExists(uint256 taskId) {
        require(taskId > 0 && taskId <= taskCounter, "Task does not exist");
        _;
    }

    modifier onlyCreator(uint256 taskId) {
        require(tasks[taskId].creator == msg.sender, "Only creator");
        _;
    }

    modifier onlyWorker(uint256 taskId) {
        require(tasks[taskId].worker == msg.sender, "Only assigned worker");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // -------- Core --------
    function createTask(
        string calldata title,
        string calldata metadataCID,
        uint8 category,
        bytes32 tagsHash,
        uint256 applyDeadline,
        uint256 deliveryDeadline
    ) external payable override returns (uint256) {
        TaskLibrary.validateTaskCreation(title, metadataCID, msg.value, applyDeadline, deliveryDeadline, category);

        taskCounter++;

        Task memory t = Task({
            id: taskCounter,
            creator: msg.sender,
            worker: address(0),
            title: title,
            metadataCID: metadataCID,
            submissionCID: "",
            reward: msg.value,
            status: TaskStatus.Open,
            createdAt: block.timestamp,
            applyDeadline: applyDeadline,
            deliveryDeadline: deliveryDeadline,
            reviewDeadline: 0,
            acceptedAt: 0,
            completedAt: 0,
            category: Category(category),
            tagsHash: tagsHash
        });

        tasks[taskCounter] = t;
        tasksByCreator[msg.sender].push(taskCounter);

        emit TaskCreated(taskCounter, msg.sender, msg.value, applyDeadline, deliveryDeadline, category, tagsHash, metadataCID);

        return taskCounter;
    }

    function applyToTask(uint256 taskId) external override taskExists(taskId) {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Open, "Not open");
        require(block.timestamp <= t.applyDeadline, "Apply deadline passed");
        require(msg.sender != t.creator, "Creator cannot apply");
        require(!hasApplied[taskId][msg.sender], "Already applied");

        hasApplied[taskId][msg.sender] = true;
        applicants[taskId].push(msg.sender);

        emit TaskApplied(taskId, msg.sender);
    }

    function getApplicants(uint256 taskId)
        external
        view
        override
        taskExists(taskId)
        returns (address[] memory)
    {
        return applicants[taskId];
    }

    function acceptWorker(uint256 taskId, address worker)
        external
        override
        taskExists(taskId)
        onlyCreator(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Open, "Not open");
        require(block.timestamp <= t.applyDeadline, "Apply deadline passed");
        require(worker != address(0), "Invalid worker");
        require(hasApplied[taskId][worker], "Worker did not apply");

        t.worker = worker;
        t.status = TaskStatus.InProgress;
        t.acceptedAt = block.timestamp;

        tasksByWorker[worker].push(taskId);

        emit WorkerAccepted(taskId, msg.sender, worker);
    }

    function submitWork(uint256 taskId, string calldata submissionCID)
        external
        override
        taskExists(taskId)
        onlyWorker(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.InProgress, "Not in progress");
        require(block.timestamp <= t.deliveryDeadline, "Delivery deadline passed");
        require(bytes(submissionCID).length > 0, "submissionCID required");

        t.status = TaskStatus.PendingApproval;
        t.submissionCID = submissionCID;

        uint256 reviewDeadline = block.timestamp + TaskLibrary.reviewPeriod();
        t.reviewDeadline = reviewDeadline;

        emit WorkSubmitted(taskId, msg.sender, submissionCID, reviewDeadline);
    }

    function approveWork(uint256 taskId)
        external
        override
        taskExists(taskId)
        onlyCreator(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.PendingApproval, "Not pending approval");
        require(t.worker != address(0), "No worker");

        _finalizePayout(taskId, false);
    }

    function autoApprove(uint256 taskId)
        external
        override
        taskExists(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.PendingApproval, "Not pending approval");
        require(t.reviewDeadline != 0, "No review deadline set");
        require(block.timestamp > t.reviewDeadline, "Review period not over");

        _finalizePayout(taskId, true);
    }

    function _finalizePayout(uint256 taskId, bool isAuto) internal {
        Task storage t = tasks[taskId];

        t.status = TaskStatus.Completed;
        t.completedAt = block.timestamp;

        uint256 fee = TaskLibrary.calculatePlatformFee(t.reward);
        uint256 workerPay = TaskLibrary.calculateWorkerPayment(t.reward);

        platformFeeBalance += fee;
        userBalances[t.worker] += workerPay;

        if (isAuto) {
            emit WorkAutoApproved(taskId, msg.sender, t.worker, workerPay);
        } else {
            emit WorkApproved(taskId, t.creator, t.worker, workerPay);
        }
    }

    function cancelTask(uint256 taskId)
        external
        override
        taskExists(taskId)
        onlyCreator(taskId)
    {
        Task storage t = tasks[taskId];
        require(
            t.status == TaskStatus.Open || t.status == TaskStatus.InProgress,
            "Cannot cancel now"
        );

        t.status = TaskStatus.Cancelled;
        userBalances[t.creator] += t.reward;

        emit TaskCancelled(taskId);
    }

    /**
     * @dev Anyone can mark an open/inprogress task as expired after deadline, freeing logic for refunds.
     * - If Open and applyDeadline passed -> expire + refund creator
     * - If InProgress and deliveryDeadline passed -> expire + refund creator (you can change this policy if you want)
     */
    function expireTask(uint256 taskId)
        external
        override
        taskExists(taskId)
    {
        Task storage t = tasks[taskId];
        require(
            t.status == TaskStatus.Open || t.status == TaskStatus.InProgress,
            "Not expirable"
        );

        bool canExpire =
            (t.status == TaskStatus.Open && block.timestamp > t.applyDeadline) ||
            (t.status == TaskStatus.InProgress && block.timestamp > t.deliveryDeadline);

        require(canExpire, "Not past deadline");

        t.status = TaskStatus.Expired;
        userBalances[t.creator] += t.reward;

        emit TaskExpired(taskId);
    }

    function addComment(uint256 taskId, string calldata message)
        external
        taskExists(taskId)
    {
        require(bytes(message).length > 0, "Empty message");
        require(bytes(message).length <= 500, "Message too long");

        Task storage t = tasks[taskId];

        require(
            msg.sender == t.creator || msg.sender == t.worker,
            "Only creator or worker can comment"
        );

        emit TaskComment(taskId, msg.sender, message, block.timestamp);
    }



    // -------- Ratings --------
    function rateWorker(uint256 taskId, uint8 stars)
        external
        override
        taskExists(taskId)
        onlyCreator(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Completed, "Not completed");
        require(!workerRated[taskId], "Already rated worker");
        require(stars >= 1 && stars <= 5, "Stars 1..5");

        workerRated[taskId] = true;

        RatingInfo storage r = ratings[t.worker];
        r.totalStars += stars;
        r.count += 1;

        emit Rated(taskId, msg.sender, t.worker, stars);
    }

    function rateCreator(uint256 taskId, uint8 stars)
        external
        override
        taskExists(taskId)
        onlyWorker(taskId)
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Completed, "Not completed");
        require(!creatorRated[taskId], "Already rated creator");
        require(stars >= 1 && stars <= 5, "Stars 1..5");

        creatorRated[taskId] = true;

        RatingInfo storage r = ratings[t.creator];
        r.totalStars += stars;
        r.count += 1;

        emit Rated(taskId, msg.sender, t.creator, stars);
    }

    function getRating(address user)
        external
        view
        override
        returns (uint256 avgStarsTimes100, uint32 count)
    {
        RatingInfo memory r = ratings[user];
        if (r.count == 0) return (0, 0);
        // avg * 100 (ex: 4.25 -> 425)
        uint256 avg100 = (uint256(r.totalStars) * 100) / uint256(r.count);
        return (avg100, r.count);
    }

    // -------- Views --------
    function getTask(uint256 taskId)
        external
        view
        override
        taskExists(taskId)
        returns (Task memory)
    {
        return tasks[taskId];
    }

    function getTasksByCreator(address creator)
        external
        view
        override
        returns (uint256[] memory)
    {
        return tasksByCreator[creator];
    }

    function getTasksByWorker(address worker)
        external
        view
        override
        returns (uint256[] memory)
    {
        return tasksByWorker[worker];
    }

    function getTotalTasks() external view override returns (uint256) {
        return taskCounter;
    }

    // -------- Withdrawals --------
    function withdraw() external override {
        uint256 amount = userBalances[msg.sender];
        require(amount > 0, "No balance");
        userBalances[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function getBalance(address user) external view override returns (uint256) {
        return userBalances[user];
    }

    // -------- Owner fees --------
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = platformFeeBalance;
        require(amount > 0, "No fees");
        platformFeeBalance = 0;

        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "Fee transfer failed");
    }

    // -------- Receive/fallback --------
    receive() external payable {
        platformFeeBalance += msg.value;
    }

    fallback() external payable {
        platformFeeBalance += msg.value;
    }
}
