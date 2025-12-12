// packages/shared/types/event.ts
import { IInvestigationState } from "./state";

export enum EventType {
	// System Events
	SESSION_INIT = 'SESSION_INIT',
	PLAYER_JOINED = 'PLAYER_JOINED',
	CONNECTION_LOST = 'CONNECTION_LOST',

	// Patient Actions
	ITEM_INTERACTION = 'ITEM_INTERACTION',
	DIALOGUE_CHOICE = 'DIALOGUE_CHOICE',

	// Doctor Actions
	INTERVENTION_TRIGGERED = 'INTERVENTION_TRIGGERED',
	NOTE_ADDED = 'NOTE_ADDED',

	// Engine Outcomes
	STATE_UPDATE = 'STATE_UPDATE',
	GAME_OVER = 'GAME_OVER'
}

// Base Event Interface
export interface IBaseEvent {
	eventId: string;          // Unique identifier for the event (UUIDv4)
	timestamp: number;       // Timestamp when the event was created (ms since epoch)
	type: EventType;        // Type of the event
	emmitterId: string;     // User ID of the event emitter
	sessionId: string;      // Associated session ID
}

// Patient Item Interaction Event
export interface IItemInteractionEvent extends IBaseEvent {
	type: EventType.ITEM_INTERACTION;
	payload: {
		itemId: string;           // ID of the item being interacted with
		action: 'INSPECT' | 'PICK_UP' | 'COMBINE';
		targetId?: string;      // Optional target item ID for combination e.g. Key + Lock
	};
}

// Doctor triggers a therapeutic intervention
export interface IInterventionTriggeredEvent extends IBaseEvent {
	type: EventType.INTERVENTION_TRIGGERED;
	payload: {
		techniqueId: string;    // ID of the intervention technique used e.g. "BREATHING_EXERCISE"
		intensity: number;      // Intensity level of the intervention (1-10)
		targetMetric: 'STRESS' | 'TRUST'; // Psychological metric targeted by the intervention
	};
}

// Payload broadcast back to clients with updated state
export interface IStateUpdateEvent extends IBaseEvent {
	type: EventType.STATE_UPDATE;
	payload: {
		previousSequenceId: number; // Last sequence ID before this update
		newSequenceId: number;      // New sequence ID after this update
		state: IInvestigationState; // Full snapshot of the updated session state
		diff: {
			stressDelta: number;    // Change in stress level e.g. -0.05 (stress reduced by 5%)
			trustDelta: number;     // Change in trust level e.g. +0.03 (trust increased by 3%)
		};
	};
}

// Dialogue choice made by the patient
export interface IDialogueChoiceEvent extends IBaseEvent {
	type: EventType.DIALOGUE_CHOICE;
	payload: {
		nodeId: string;           // Current dialogue node ID
		choiceId: string;        // ID of the choice made by the patient
	};
}

// Game Over Event
export interface IGameOverEvent extends IBaseEvent {
	type: EventType.GAME_OVER;
	payload: {
		outcome: 'SUCCESS' | 'FAILURE';
		finalMetrics: {
			trust: number;
			stress: number;
			compliance: number;
		};
	};
}

// Union Type for All Events
export type GameEvent =
	| IItemInteractionEvent
	| IInterventionTriggeredEvent
	| IStateUpdateEvent
	| IDialogueChoiceEvent
	| IGameOverEvent;
