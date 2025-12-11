// packages/shared/types/session.ts

import { GameEvent } from "./event";
import { IInvestigationState } from "./state";

export interface ISessionStartRequest {
	patientId: string;      // User ID of the Patient
	mode: 'AI' | 'P2P'; // Session mode: AI-guided or Peer-to-Peer
}

export interface ISessionStartResponse {
	sessionId: string;      // Unique identifier for the session (UUIDv4)
	wsUrl: string;         // WebSocket URL to connect for real-time updates
}

export interface ISessionHistoryResponse {
	sessionId: string;      // Unique identifier for the session (UUIDv4)
	events: GameEvent[];        // Chronological list of events that occurred during the session
	finalState: IInvestigationState; // Final state snapshot at the end of the session
}

export interface ISurrenderRequest {
	reason: string;        // Reason provided by the Patient for surrendering
}

export interface ISurrenderResponse {
	success: boolean;     // Indicates if the surrender was processed successfully
}
