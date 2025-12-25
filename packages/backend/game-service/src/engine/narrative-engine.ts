import { v4 as uuidv4 } from 'uuid';
import type {
	IInvestigationState,
	IInventoryItem,
	IParticipantState,
} from '@speak-up/shared';
import {
	EventType,
	type IBaseEvent,
	type IItemInteractionEvent,
	type IInterventionTriggeredEvent,
	type IStateUpdateEvent,
	type IDialogueChoiceEvent,
	type GameEvent,
} from '@speak-up/shared';

// generic scenrio node interface
interface IScenarioNode {
	id: string;
	type: 'dialogue' | 'choice' | 'event' | 'ending';
	content?: string;
	choices?: { id: string; text: string; nextNodeId: string; effects?: MetricEffects }[];
	nextNodeId?: string;
	effects?: MetricEffects;
	requirements?: Record<string, boolean>; // required scenario narrative flags
	unlocks?: string[]; // unlocks item or other
}

interface MetricEffects {
	trust?: number;
	stress?: number;
	compliance?: number;
	mood?: IInvestigationState['metrics']['mood'];
}

interface IScenario {
	id: string;
	title: string;
	startNodeId: string;
	nodes: Map<string, IScenarioNode>;
	items: IInventoryItem[];
}

export class NarrativeEngine {
	private state: IInvestigationState;
	private scenario: IScenario;
	private eventLog: GameEvent[] = [];
	private onStateChange?: (state: IInvestigationState, event: IStateUpdateEvent) => void;

	constructor(
		sessionId: string,
		scenario: IScenario,
		patientId: string,
		doctorId: string | null
	) {
		this.scenario = scenario;
		this.state = this.initializeState(sessionId, patientId, doctorId);
	}

	// initialize gamestate
	private initializeState(
		sessionId: string,
		patientId: string,
		doctorId: string | null
	): IInvestigationState {
		return {
			sessionId,
			sequenceId: 0,
			lastUpdateTimestamp: Date.now(),
			status: 'WAITING',

			metrics: {
				trust: 0.5,
				stress: 0.3,
				compliance: 0.5,
				mood: 'CALM',
			},

			actionNodeId: this.scenario.startNodeId,
			narrativeFlags: {},
			inventory: this.scenario.items.filter(i => i.status === 'VISIBLE'),

			participants: {
				patient: {
					userId: patientId,
					connectionStatus: 'ONLINE',
					lastAckSequenceId: 0,
					currentActivity: 'IDLE',
				},
				doctor: {
					userId: doctorId || 'AI_DOCTOR',
					connectionStatus: doctorId ? 'OFFLINE' : 'ONLINE', // AI always online
					lastAckSequenceId: 0,
					currentActivity: 'IDLE',
				},
			},
		};
	}

	// set ccallback
	setOnStateChange(callback: (state: IInvestigationState, event: IStateUpdateEvent) => void) {
		this.onStateChange = callback;
	}

	// get curr state
	getState(): IInvestigationState {
		return { ...this.state };
	}

	// get event log
	getEventLog(): GameEvent[] {
		return [...this.eventLog];
	}

	// start session
	start(): IInvestigationState {
		this.state.status = 'ACTIVE';
		this.state.lastUpdateTimestamp = Date.now();
		return this.getState();
	}

	// pause session
	pause(): IInvestigationState {
		this.state.status = 'PAUSED';
		this.state.lastUpdateTimestamp = Date.now();
		return this.getState();
	}

	// resume session
	resume(): IInvestigationState {
		this.state.status = 'ACTIVE';
		this.state.lastUpdateTimestamp = Date.now();
		return this.getState();
	}

	// process playeraction event
	processEvent(event: GameEvent): IStateUpdateEvent | null {
		if (this.state.status !== 'ACTIVE') {
			console.warn(`Cannot process event: session is ${this.state.status}`);
			return null;
		}

		// log event
		this.eventLog.push(event);

		let stateChanged = false;
		const previousMetrics = { ...this.state.metrics };

		switch (event.type) {
			case EventType.ITEM_INTERACTION:
				stateChanged = this.handleItemInteraction(event as IItemInteractionEvent);
				break;

			case EventType.DIALOGUE_CHOICE:
				stateChanged = this.handleDialogueChoice(event as IDialogueChoiceEvent);
				break;

			case EventType.INTERVENTION_TRIGGERED:
				stateChanged = this.handleIntervention(event as IInterventionTriggeredEvent);
				break;

			default:
				console.warn(`Unknown event type: ${event.type}`);
				return null;
		}

		if (!stateChanged) {
			return null;
		}

		// check game conditions
		this.checkGameConditions();

		// update event state
		const stateUpdateEvent: IStateUpdateEvent = {
			eventId: uuidv4(),
			timestamp: Date.now(),
			type: EventType.STATE_UPDATE,
			emitterId: 'ENGINE',
			sessionId: this.state.sessionId,
			payload: {
				previousSequenceId: this.state.sequenceId,
				newSequenceId: ++this.state.sequenceId,
				state: this.getState(),
				diff: {
					stressDelta: this.state.metrics.stress - previousMetrics.stress,
					trustDelta: this.state.metrics.trust - previousMetrics.trust,
				},
			},
		};

		this.state.lastUpdateTimestamp = Date.now();

		// notify listens (onstatechange)
		if (this.onStateChange) {
			this.onStateChange(this.getState(), stateUpdateEvent);
		}

		return stateUpdateEvent;
	}

	// handle interacct with item
	private handleItemInteraction(event: IItemInteractionEvent): boolean {
		const { itemId, action, targetId } = event.payload;

		// find item index
		const itemIndex = this.state.inventory.findIndex(i => i.id === itemId);
		
		if (itemIndex === -1) {
			// if unfound, check scenario items
			const scenarioItem = this.scenario.items.find(i => i.id === itemId);
			if (!scenarioItem || scenarioItem.status === 'LOCKED') {
				return false;
			}
		}

		const item = this.state.inventory[itemIndex] || this.scenario.items.find(i => i.id === itemId)!;

		switch (action) {
			case 'INSPECT':
				// inspecting increases stress
				this.applyMetricChange({ stress: 0.05 });
				
				// check if item unlocks something
				if (item.type === 'DOCUMENT' || item.type === 'CONCEPTUAL') {
					this.state.narrativeFlags[`INSPECTED_${itemId.toUpperCase()}`] = true;
				}
				break;

			case 'PICK_UP':
				if (itemIndex === -1) {
					// add item to inventory
					this.state.inventory.push({ ...item, status: 'HELD', acquiredAt: Date.now() });
				} else {
					this.state.inventory[itemIndex].status = 'HELD';
				}
				break;

			case 'COMBINE':
				if (targetId) {
					// handle combination logic
					this.state.narrativeFlags[`COMBINED_${itemId}_${targetId}`] = true;
					// solving a problem reduces stress
					this.applyMetricChange({ stress: -0.1, trust: 0.05 });
				}
				break;
		}

		return true;
	}

	// handle dialogue
	private handleDialogueChoice(event: IDialogueChoiceEvent): boolean {
		const { nodeId, choiceId } = event.payload;

		// check if correct node (protect choices out of bounds)
		if (this.state.actionNodeId !== nodeId) {
			console.warn(`Invalid dialogue choice: expected node ${this.state.actionNodeId}, got ${nodeId}`);
			return false;
		}

		const currentNode = this.scenario.nodes.get(nodeId);
		if (!currentNode || currentNode.type !== 'choice') {
			return false;
		}

		const choice = currentNode.choices?.find(c => c.id === choiceId);
		if (!choice) {
			return false;
		}

		// apply choice effects
		if (choice.effects) {
			this.applyMetricChange(choice.effects);
		}

		// next node
		this.state.actionNodeId = choice.nextNodeId;

		// set narrative flag for choice
		this.state.narrativeFlags[`CHOICE_${nodeId}_${choiceId}`] = true;

		// check if automatic and process
		this.processCurrentNode();

		return true;
	}

	// handle doctor intervention
	private handleIntervention(event: IInterventionTriggeredEvent): boolean {
		const { techniqueId, intensity, targetMetric } = event.payload;

		// use intensity var to affect targeted metric
		const effect = (intensity / 10) * 0.15; // Max 15% change per intervention

		if (targetMetric === 'STRESS') {
			// if it reduces stress
			this.applyMetricChange({ stress: -effect });
		} else if (targetMetric === 'TRUST') {
			// if it builds trust
			const trustEffect = intensity > 7 ? effect * 0.8 : effect;
			this.applyMetricChange({ trust: trustEffect });
		}

		// record intervention in flags
		this.state.narrativeFlags[`INTERVENTION_${techniqueId}`] = true;

		return true;
	}

	// process node effects
	private processCurrentNode(): void {
		const node = this.scenario.nodes.get(this.state.actionNodeId);
		if (!node) return;

		// apply effects
		if (node.effects) {
			this.applyMetricChange(node.effects);
		}

		// unlock items
		if (node.unlocks) {
			for (const itemId of node.unlocks) {
				const item = this.scenario.items.find(i => i.id === itemId);
				if (item && item.status === 'LOCKED') {
					item.status = 'VISIBLE';
					this.state.inventory.push({
						...item,
						status: 'VISIBLE',
						unlockedBy: this.state.actionNodeId,
					});
				}
			}
		}

		// auto advance if possible
		if (node.type === 'event' && node.nextNodeId) {
			this.state.actionNodeId = node.nextNodeId;
		}

		// check for ending
		if (node.type === 'ending') {
			this.state.status = 'COMPLETED';
		}
	}

	// clamp applied metrics
	private applyMetricChange(effects: MetricEffects): void {
		if (effects.trust !== undefined) {
			this.state.metrics.trust = Math.max(0, Math.min(1, this.state.metrics.trust + effects.trust));
		}
		if (effects.stress !== undefined) {
			this.state.metrics.stress = Math.max(0, Math.min(1, this.state.metrics.stress + effects.stress));
		}
		if (effects.compliance !== undefined) {
			this.state.metrics.compliance = Math.max(0, Math.min(1, this.state.metrics.compliance + effects.compliance));
		}
		if (effects.mood !== undefined) {
			this.state.metrics.mood = effects.mood;
		}
		// update mood based on metrics
		this.updateMood();
	}

	// update mood
	private updateMood(): void {
		const { stress, trust } = this.state.metrics;

		if (stress > 0.8) {
			this.state.metrics.mood = 'ANXIOUS';
		} else if (trust > 0.8 && stress < 0.3) {
			this.state.metrics.mood = 'BREAKTHROUGH';
		} else if (trust < 0.3 && stress > 0.5) {
			this.state.metrics.mood = 'DEFENSIVE';
		} else {
			this.state.metrics.mood = 'CALM';
		}
	}

	// check game conditions
	private checkGameConditions(): void {
		// if stress exceeds max threshold
		if (this.state.metrics.stress >= 1.0) {
			this.state.status = 'TERMINATED';
			return;
		}

		// if high trust with low stress
		const currentNode = this.scenario.nodes.get(this.state.actionNodeId);
		if (currentNode?.type === 'ending') {
			this.state.status = 'COMPLETED';
		}
	}

	// update participants
	updateParticipantStatus(
		role: 'patient' | 'doctor',
		status: IParticipantState['connectionStatus']
	): void {
		this.state.participants[role].connectionStatus = status;
		this.state.lastUpdateTimestamp = Date.now();
	}

	// update p activity
	updateParticipantActivity(
		role: 'patient' | 'doctor',
		activity: IParticipantState['currentActivity']
	): void {
		this.state.participants[role].currentActivity = activity;
	}

	// ACK state received
	acknowledgeState(role: 'patient' | 'doctor', sequenceId: number): void {
		this.state.participants[role].lastAckSequenceId = sequenceId;
	}

	// delta events
	getDeltaEvents(fromSequenceId: number): GameEvent[] {
		return this.eventLog.filter((_, index) => index >= fromSequenceId);
	}

	// terminating a session
	terminate(reason: string): IInvestigationState {
		this.state.status = 'TERMINATED';
		this.state.narrativeFlags['TERMINATION_REASON'] = true;
		this.state.lastUpdateTimestamp = Date.now();
		console.log(`Session terminated: ${reason}`);
		return this.getState();
	}
}

// create an enging from a sccenario JSON
export function createEngineFromScenario(
	sessionId: string,
	scenarioData: {
		id: string;
		title: string;
		logicTree: {
			startNodeId: string;
			nodes: IScenarioNode[];
			items: IInventoryItem[];
		};
	},
	patientId: string,
	doctorId: string | null
): NarrativeEngine {
	const nodes = new Map<string, IScenarioNode>();
	for (const node of scenarioData.logicTree.nodes) {
		nodes.set(node.id, node);
	}

	const scenario: IScenario = {
		id: scenarioData.id,
		title: scenarioData.title,
		startNodeId: scenarioData.logicTree.startNodeId,
		nodes,
		items: scenarioData.logicTree.items || [],
	};

	return new NarrativeEngine(sessionId, scenario, patientId, doctorId);
}
