// metadata for scenario listing
export interface IScenario {
	id: string;
	title: string;
	description: string;
	difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
	estimatedDuration: number; // in minutes
	graphData?: IScenarioGraph;
	initialState?: IScenarioInitialState;
	createdAt: Date | string;
	updatedAt: Date | string;
}

// list response
export interface IScenarioListResponse {
	scenarios: Omit<IScenario, 'graphData' | 'initialState'>[];
}

// scenario graph for narrative branching
export interface IScenarioGraph {
	nodes: IScenarioNode[];
	edges: IScenarioEdge[];
	startNodeId: string;
	endNodeIds: string[];
}

// node in a scenario
export interface IScenarioNode {
	id: string;
	type: 'DIALOGUE' | 'CHOICE' | 'ACTION' | 'OUTCOME' | 'CHECKPOINT';
	content: {
		speaker?: 'PATIENT' | 'DOCTOR' | 'NARRATOR';
		text?: string;
		choices?: IDialogueChoice[];
		action?: {
			type: string;
			params: Record<string, unknown>;
		};
	};
	effects?: INodeEffect[];
	conditions?: INodeCondition[];
}

// edge node
export interface IScenarioEdge {
	from: string;
	to: string;
	conditions?: INodeCondition[];
	priority?: number;
}

// dialogue choice
export interface IDialogueChoice {
	id: string;
	text: string;
	targetNodeId: string;
	effects?: INodeEffect[];
	conditions?: INodeCondition[];
}

// nodes that have effects
export interface INodeEffect {
	type: 'METRIC_CHANGE' | 'FLAG_SET' | 'ITEM_GRANT' | 'MOOD_CHANGE' | 'CUSTOM';
	target?: string; // e.g., 'trust', 'stress', 'FOUND_DIARY'
	value?: number | string | boolean;
	params?: Record<string, unknown>;
}

// conditions to access nodes
export interface INodeCondition {
	type: 'FLAG_CHECK' | 'METRIC_THRESHOLD' | 'ITEM_CHECK' | 'MOOD_CHECK' | 'CUSTOM';
	target: string;
	operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'HAS' | 'NOT_HAS';
	value: number | string | boolean;
}

// initial state config for a scenario
export interface IScenarioInitialState {
	metrics: {
		trust: number;
		stress: number;
		compliance: number;
		mood: 'CALM' | 'ANXIOUS' | 'DEFENSIVE' | 'BREAKTHROUGH';
	};
	narrativeFlags: Record<string, boolean>;
	inventory: string[]; // items
}

// scenario leaderboard entry
export interface IScenarioLeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatarUrl?: string;
	metrics: {
		trust: number;
		stress: number;
		compliance: number;
	};
	duration: number; // seconds
	completedAt: Date | string;
}

// lb response
export interface IScenarioLeaderboardResponse {
	scenarioId: string;
	leaderboard: IScenarioLeaderboardEntry[];
}

// scenario stats response
export interface IScenarioStatsResponse {
	scenarioId: string;
	totalSessions: number;
	completedSessions: number;
	completionRate: number;
	averageDuration: number | null;
	averageMetrics: {
		trust: string | null;
		compliance: string | null;
	};
}
