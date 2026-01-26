// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ITaskMarketplace
 * @dev Interface for TaskMarketplace V2
 */
interface ITaskMarketplace {
    enum TaskStatus { Open, InProgress, PendingApproval, Completed, Cancelled, Expired }

    enum Category { Dev, Design, Writing, Data, Other }

    struct RatingInfo {
        uint32 totalStars;
        uint32 count;
    }

    struct Task {
        uint256 id;
        address creator;
        address worker;              // assigned worker (0 until accepted)
        string title;

        // IPFS metadata CID (JSON containing description, tags strings, attachments, etc.)
        string metadataCID;

        // Optional: CID for submitted work proof (e.g., deliverables)
        string submissionCID;

        uint256 reward;
        TaskStatus status;

        uint256 createdAt;
        uint256 applyDeadline;       // last moment to apply / accept
        uint256 deliveryDeadline;    // last moment to submit work
        uint256 reviewDeadline;      // set when worker submits work: now + reviewPeriod

        uint256 acceptedAt;
        uint256 completedAt;

        Category category;
        bytes32 tagsHash;            // hash of tags list (off-chain) OR hash of metadata contents
    }

    // ---------- Events ----------
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 reward,
        uint256 applyDeadline,
        uint256 deliveryDeadline,
        uint8 category,
        bytes32 tagsHash,
        string metadataCID
    );

    event TaskApplied(uint256 indexed taskId, address indexed applicant);
    event WorkerAccepted(uint256 indexed taskId, address indexed employer, address indexed worker);

    event WorkSubmitted(uint256 indexed taskId, address indexed worker, string submissionCID, uint256 reviewDeadline);
    event WorkApproved(uint256 indexed taskId, address indexed employer, address indexed worker, uint256 workerPayment);
    event WorkAutoApproved(uint256 indexed taskId, address indexed trigger, address indexed worker, uint256 workerPayment);

    event TaskCancelled(uint256 indexed taskId);
    event TaskExpired(uint256 indexed taskId);

    event CommentAdded(uint256 indexed taskId, address indexed author, string cid);

    event Rated(uint256 indexed taskId, address indexed from, address indexed to, uint8 stars);

    // ---------- Core ----------
    function createTask(
        string calldata title,
        string calldata metadataCID,
        uint8 category,
        bytes32 tagsHash,
        uint256 applyDeadline,
        uint256 deliveryDeadline
    ) external payable returns (uint256);

    function applyToTask(uint256 taskId) external;
    function getApplicants(uint256 taskId) external view returns (address[] memory);

    function acceptWorker(uint256 taskId, address worker) external;

    function submitWork(uint256 taskId, string calldata submissionCID) external;
    function approveWork(uint256 taskId) external;
    function autoApprove(uint256 taskId) external;

    function cancelTask(uint256 taskId) external;
    function expireTask(uint256 taskId) external;

    function addComment(uint256 taskId, string calldata cid) external;

    // Ratings (after completion)
    function rateWorker(uint256 taskId, uint8 stars) external;
    function rateCreator(uint256 taskId, uint8 stars) external;

    // Views
    function getTask(uint256 taskId) external view returns (Task memory);
    function getTasksByCreator(address creator) external view returns (uint256[] memory);
    function getTasksByWorker(address worker) external view returns (uint256[] memory);

    function getRating(address user) external view returns (uint256 avgStarsTimes100, uint32 count);

    // Withdrawal pattern
    function withdraw() external;
    function getBalance(address user) external view returns (uint256);

    function getTotalTasks() external view returns (uint256);
}
