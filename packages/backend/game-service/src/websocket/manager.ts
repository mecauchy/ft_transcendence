import {WebSocket} from 'ws';
import {FastifyRequest} from 'fastify';
import jwt, {JwtPayload} from 'jsonwebtoken';
import Redis from 'ioredis';
import {v4 as uuidv4} from 'uuid';
import {config} from '../config';
import {NarrativeEngine, createEngineFromScenario} from '../engine/narrative-engine';
import {prisma} from '../db';
import type {IInvestigationState} from '@speak-up/shared';
import {EventType, type GameEvent, type IStateUpdateEvent} from '@speak-up/shared';

interface AuthenticatedUser {
	userId: string;
	role: string;
}

interface ClientConnection {
	socket: WebSocket;
	user: AuthenticatedUser;
	sessionId: string;
	role: 'patient' | 'doctor' | 'spectator';
	lastPing: number;
}

interface GameSession {
	id: string;
	engine: NarrativeEngine;
	clients: Map<string, ClientConnection>;
	spectators: Map<string, ClientConnection>;
	createdAt: number;
	lastActivity: number;
}

export class WebSocketManager {
	private sessions: Map<string, GameSession> = new Map();
	private redis: Redis;
	private heartbeatInterval: NodeJS.Timeout | null = null;

	constructor() {
		this.redis = new Redis({
			host: config.redis.host,
			port: config.redis.port,
			password: config.redis.password,
		});

		// start health check
		this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 30000);
	}

	// handle new websocket conn
	handleConnection(socket: WebSocket, request: FastifyRequest): void {
		const query_params = request.query as {token?: string; sessionId?: string; mode?: string};
		const {token, sessionId, mode} = query_params;

		// validate token
		if (!token) {
			this.closeWithError(socket, 'Missing authentication token');
			return;
		}

		let user: AuthenticatedUser;
		try {
			const decoded = jwt.verify(token, config.jwt.secret, {
				issuer: config.jwt.issuer,
			}) as JwtPayload & AuthenticatedUser;
			user = {userId: decoded.userId, role: decoded.role};
		} catch (error) {
			this.closeWithError(socket, 'Invalid or expired token');
			return;
		}

		// handle connection based on mode
		if (mode === 'spectator' && sessionId) {
			this.handleSpectatorConnection(socket, user, sessionId);
		} else if (sessionId) {
			this.handlePlayerConnection(socket, user, sessionId);
		} else {
			this.closeWithError(socket, 'Session ID required');
		}
	}

	// handle player connection
	private async handlePlayerConnection(
		socket: WebSocket,
		user: AuthenticatedUser,
		sessionId: string
	): Promise<void> {
		let session = this.sessions.get(sessionId);

		if (!session) {
			// load session from db
			try {
				const dbSession = await prisma.session.findUnique({
					where: {id: sessionId},
					include: {
						scenario: true,
					},
				});

				if (!dbSession) {
					this.closeWithError(socket, 'Session not found');
					return;
				}

				// create engine
				const engine = createEngineFromScenario(
					sessionId,
					{
						id: dbSession.scenarioId?.toString() || '',
						title: 'Loaded Scenario',
						logicTree: dbSession.scenario?.logicTree as any,
					},
					dbSession.patientId?.toString() || '',
					dbSession.doctorId?.toString() || null
				);

				session = {
					id: sessionId,
					engine,
					clients: new Map(),
					spectators: new Map(),
					createdAt: Date.now(),
					lastActivity: Date.now(),
				};

				// set up state change callback to broadcast
				engine.setOnStateChange((state, event) => {
					this.broadcastToSession(sessionId, event);
				});

				this.sessions.set(sessionId, session);
			} catch (error) {
				console.error('Failed to load session:', error);
				this.closeWithError(socket, 'Failed to load session');
				return;
			}
		}

		// determine player role
		const state = session.engine.getState();
		let role: 'patient' | 'doctor';

		if (state.participants.patient.userId === user.userId) {
			role = 'patient';
		} else if (state.participants.doctor.userId === user.userId) {
			role = 'doctor';
		} else {
			this.closeWithError(socket, 'User not part of this session');
			return;
		}

		// create client connection
		const clientId = uuidv4();
		const client: ClientConnection = {
			socket,
			user,
			sessionId,
			role,
			lastPing: Date.now(),
		};

		session.clients.set(clientId, client);
		session.lastActivity = Date.now();

		// update participant status
		session.engine.updateParticipantStatus(role, 'ONLINE');

		// redis setup presence
		await this.redis.setex(`presence:${user.userId}`, 3600, 'online');
		await this.redis.setex(`session:${user.userId}`, 3600, sessionId);

		// initial state
		this.sendToClient(socket, {
			type: 'CONNECTED',
			sessionId,
			role,
			state: session.engine.getState(),
		});

		// setup message handlers
		socket.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				this.handleMessage(session!, clientId, message);
			} catch (error) {
				console.error('Invalid message format:', error);
			}
		});

		socket.on('close', () => {
			this.handleDisconnect(sessionId, clientId);
		});

		socket.on('error', (error) => {
			console.error('WebSocket error:', error);
			this.handleDisconnect(sessionId, clientId);
		});

		// notify others
		this.broadcastToSession(sessionId, {
			type: 'PLAYER_JOINED',
			userId: user.userId,
			role,
		});
	}

	// handle connection for spectators
	private async handleSpectatorConnection(
		socket: WebSocket,
		user: AuthenticatedUser,
		sessionId: string
	): Promise<void> {
		const session = this.sessions.get(sessionId);

		if (!session) {
			this.closeWithError(socket, 'Session not found or not active');
			return;
		}

		// spectator limit
		if (session.spectators.size >= config.game.maxSpectatorsPerSession) {
			this.closeWithError(socket, 'Session spectator limit reached');
			return;
		}

		const spectatorId = uuidv4();
		const spectator: ClientConnection = {
			socket,
			user,
			sessionId,
			role: 'spectator',
			lastPing: Date.now(),
		};

		session.spectators.set(spectatorId, spectator);

		// current state
		this.sendToClient(socket, {
			type: 'SPECTATOR_CONNECTED',
			sessionId,
			state: session.engine.getState(),
			spectatorCount: session.spectators.size,
		});

		socket.on('close', () => {
			session.spectators.delete(spectatorId);
		});

		socket.on('error', () => {
			session.spectators.delete(spectatorId);
		});
	}

	// handle messages incoming
	private handleMessage(
		session: GameSession,
		clientId: string,
		message:	{type: string; payload?: unknown}
	): void {
		const client = session.clients.get(clientId);
		if (!client) return;

		client.lastPing = Date.now();
		session.lastActivity = Date.now();

		switch (message.type) {
			case 'PONG':
				break;

			case 'GAME_EVENT':
				// process gameevent through game engine
				const event = message.payload as GameEvent;
				if (event) {
					event.emitterId = client.user.userId;
					event.sessionId = session.id;
					session.engine.processEvent(event);
				}
				break;

			case 'STATE_ACK':
				// client ACK
				const sequenceId = (message.payload as {sequenceId: number})?.sequenceId;
				if (sequenceId !== undefined) {
					session.engine.acknowledgeState(client.role as 'patient' | 'doctor', sequenceId);
				}
				break;

			case 'RESYNC_REQUEST':
				// request state resync
				const fromSequence = (message.payload as {lastSequenceId: number})?.lastSequenceId || 0;
				const deltaEvents = session.engine.getDeltaEvents(fromSequence);
				this.sendToClient(client.socket, {
					type: 'RESYNC_RESPONSE',
					state: session.engine.getState(),
					deltaEvents,
				});
				break;

			case 'ACTIVITY_UPDATE':
				// client activity change
				const activity = (message.payload as {activity: string})?.activity;
				if (activity && client.role !== 'spectator') {
					session.engine.updateParticipantActivity(
						client.role as 'patient' | 'doctor',
						activity as 'IDLE' | 'TYPING' | 'READING' | 'INTERACTING'
					);
				}
				break;

			default:
				console.warn('Unknown message type:', message.type);
		}
	}

	// handle client disconnect
	private async handleDisconnect(sessionId: string, clientId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) return;

		const client = session.clients.get(clientId);
		if (!client) return;

		// update participant status
		if (client.role !== 'spectator') {
			session.engine.updateParticipantStatus(client.role, 'OFFLINE');
		}

		// redis cleanup
		await this.redis.del(`presence:${client.user.userId}`);
		await this.redis.del(`session:${client.user.userId}`);

		// remove client
		session.clients.delete(clientId);

		// broadcast
		this.broadcastToSession(sessionId, {
			type: 'CONNECTION_LOST',
			userId: client.user.userId,
			role: client.role,
		});

		// if no clients left -> clean up session after timeout
		if (session.clients.size === 0) {
			setTimeout(() => {
				if (session.clients.size === 0) {
					this.cleanupSession(sessionId);
				}
			}, config.game.reconnectWindow);
		}
	}

	// broadcast to session
	private broadcastToSession(sessionId: string, message:	unknown): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;

		const data = JSON.stringify(message);

		// send to players
		for (const client of session.clients.values()) {
			if (client.socket.readyState === WebSocket.OPEN) {
				client.socket.send(data);
			}
		}

		// send to spectators
		for (const spectator of session.spectators.values()) {
			if (spectator.socket.readyState === WebSocket.OPEN) {
				spectator.socket.send(data);
			}
		}
	}

	// send msg to a specific client
	private sendToClient(socket: WebSocket, message:	unknown): void {
		if (socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify(message));
		}
	}

	// socket close with error msg
	private closeWithError(socket: WebSocket, message:	string): void {
		this.sendToClient(socket, {type: 'ERROR', message});
		socket.close(4000, message);
	}

	// check heartbeats for all connections
	private checkHeartbeats(): void {
		const now = Date.now();
		const timeout = 60000; // 60 seconds

		for (const [sessionId, session] of this.sessions) {
			for (const [clientId, client] of session.clients) {
				if (now - client.lastPing > timeout) {
					console.log(`Client ${clientId} heartbeat timeout`);
					client.socket.close(4001, 'Heartbeat timeout');
					this.handleDisconnect(sessionId, clientId);
				} else {
					this.sendToClient(client.socket, {type: 'PING'});
				}
			}
		}
	}

	// cleanup inactive session
	private async cleanupSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) return;

		// save final state to db
		const state = session.engine.getState();
		const events = session.engine.getEventLog();

		// Map game state status to Prisma enum
		const statusMap: Record<string, 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED'> = {
			'WAITING': 'WAITING',
			'IN_PROGRESS': 'ACTIVE',
			'ACTIVE': 'ACTIVE',
			'PAUSED': 'PAUSED',
			'COMPLETED': 'COMPLETED',
			'ABANDONED': 'TERMINATED',
			'TERMINATED': 'TERMINATED',
		};

		try {
			await prisma.session.update({
				where: {id: sessionId},
				data: {
					status: statusMap[state.status] || 'TERMINATED',
					endedAt: new Date(),
					finalMetrics: state.metrics as object,
				},
			});

			// log events
			for (let i = 0; i < events.length; i++) {
				const event = events[i];
				await prisma.eventLog.upsert({
					where: {
						sessionId_sequenceId: {
							sessionId: sessionId,
							sequenceId: i,
						},
					},
					update: {},
					create: {
						sessionId: sessionId,
						sequenceId: i,
						eventType: event.type,
						emitterId: BigInt(event.emitterId || '0'),
						payload: JSON.parse(JSON.stringify(event)) as object,
					},
				});
			}
		} catch (error) {
			console.error('Failed to save session:', error);
		}

		// remove from memory
		this.sessions.delete(sessionId);
		console.log(`Session ${sessionId} cleaned up`);
	}

	// count of active sessions
	getActiveSessionCount(): number {
		return this.sessions.size;
	}

	// get a session by ID
	getSession(sessionId: string): GameSession | undefined {
		return this.sessions.get(sessionId);
	}

	// create a session
	async createSession(
		scenarioId: string,
		patientId: string,
		doctorId: string | null
	): Promise<string> {
		// load scenario from database
		const scenario = await prisma.scenario.findUnique({
			where: {id: BigInt(scenarioId)},
		});

		if (!scenario) {
			throw new Error('Scenario not found');
		}

		// create session in db
		const newSession = await prisma.session.create({
			data: {
				patientId: BigInt(patientId),
				doctorId: doctorId ? BigInt(doctorId) : null,
				scenarioId: BigInt(scenarioId),
				mode: doctorId ? 'P2P' : 'AI',
				status: 'WAITING',
			},
		});

		const sessionId = newSession.id.toString();

		// create game engine
		const engine = createEngineFromScenario(
			sessionId,
			{
				id: scenario.id.toString(),
				title: scenario.title,
				logicTree: scenario.logicTree as any,
			},
			patientId,
			doctorId
		);

		// create session in memory
		const session: GameSession = {
			id: sessionId,
			engine,
			clients: new Map(),
			spectators: new Map(),
			createdAt: Date.now(),
			lastActivity: Date.now(),
		};

		// setup state change callback
		engine.setOnStateChange((state, event) => {
			this.broadcastToSession(sessionId, event);
		});

		this.sessions.set(sessionId, session);

		return sessionId;
	}

	// shutdown sig
	shutdown(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		// close all connections
		for (const session of this.sessions.values()) {
			for (const client of session.clients.values()) {
				client.socket.close(1001, 'Server shutting down');
			}
			for (const spectator of session.spectators.values()) {
				spectator.socket.close(1001, 'Server shutting down');
			}
		}

		this.redis.quit();
	}
}
