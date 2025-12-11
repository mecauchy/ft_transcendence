// packages/shared/types/state.ts

/**
 * IInvestigationState: The immutable snapshot of a session at a specific tick.
 * This object is serialized and broadcast via WebSockets.
 */
export interface IInvestigationState {
	// Idetity and Synchronization
	sessionId: string;          // Unique identifier for the session (UUIDv4)
	sequenceId: number;       // Incremental sequence number for synchronization
	lastUpdateTimestamp: number; // Timestamp of the last update (ms since epoch)
	status: 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED'; // Current status of the session

	//  Psychological Metrics
	// Normalized between 0 and 1
	metrics: {
		trust: number;        // Trust level between Patient and Doctor
		stress: number;       // Stress level of the Patient (Loss condition if > 1.0)
		compliance: number;   // Compliance level of the Patient to follow instructions
		mood: 'CALM' | 'ANXIOUS' | 'DEFENSIVE' | 'BREAKTHROUGH'; // Current mood state of the Patient
	};

	// Narrative Progression
	actionNodeId: string;     // Current dialogue/scenario node identifier
	narrativeFlags: Record<string, boolean>; // e.g. { "FOUND_DIARY": true} for branching paths

	// Inventory Management (Evidence/Items)
	inventory: IInventoryItem[]; // List of items/evidence collected during the session

	// Participant Presence
	participants: {
		patient: IParticipantState;
		doctor: IParticipantState;
	};
}

export interface IInventoryItem {
	id: string;               // Unique identifier for the item e.g. "item_teddy_bear"
	type: 'PHYSICAL' | 'CONCEPTUAL' | 'DOCUMENT'; // Type of item
	status: 'LOCKED' | 'VISIBLE' | 'HELD' | 'USED' | 'ANALYZED'; // Current status
	acquiredAt: number;     // Timestamp when the item was acquired
	unlockedBy: string;     // ActionNodeId or condition that unlocked the item
}

export interface IParticipantState {
	userId: string;           // Unique identifier of the participant
	connectionStatus: 'ONLINE' | 'OFFLINE' | 'RECONNECTING'; // Current connection status
	lastAckSequenceId: number; // Last acknowledged sequence ID from this participant confirmed by server
	currentActivity: 'IDLE' | 'TYPING' | 'READING' | 'INTERACTING'; // Current activity state
}
