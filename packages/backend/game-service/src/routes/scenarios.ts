import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {IScenario, IScenarioListResponse, IScenarioStatsResponse, IScenarioLeaderboardResponse, IScenarioLeaderboardEntry} from '@speak-up/shared';

// list all scenarios
async function listScenarios(request: FastifyRequest, reply: FastifyReply) {
	const scenarios = await prisma.scenario.findMany({
		orderBy: {createdAt: 'desc'},
	});

	const response: IScenarioListResponse = {
		scenarios: scenarios.map((row) => ({
			id: row.id.toString(),
			title: row.title,
			description: row.description ?? '',
			difficulty: row.difficulty as IScenario['difficulty'],
			estimatedDuration: row.estimatedDuration,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		})),
	};
	return reply.send(response);
}

// get scenario details
async function getScenario(
	request: FastifyRequest<{Params: {id: string}}>,
	reply: FastifyReply
) {
	const {id} = request.params;

	const row = await prisma.scenario.findUnique({
		where: {id: BigInt(id)},
	});

	if (!row) {
		return reply.status(404).send({error: 'Scenario not found'});
	}

	const scenario: IScenario = {
		id: row.id.toString(),
		title: row.title,
		description: row.description ?? '',
		difficulty: row.difficulty as IScenario['difficulty'],
		estimatedDuration: row.estimatedDuration,
		graphData: row.logicTree as unknown as IScenario['graphData'],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};

	return reply.send(scenario);
}

// get scenario statistics
async function getScenarioStats(
	request: FastifyRequest<{Params: {id: string}}>,
	reply: FastifyReply
) {
	const {id} = request.params;
	const scenarioId = BigInt(id);

	// Get sessions for this scenario
	const sessions = await prisma.session.findMany({
		where: {scenarioId},
	});

	const totalSessions = sessions.length;
	const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
	const completedCount = completedSessions.length;

	// Calculate averages from completed sessions
	let avgDuration: number | null = null;
	let avgTrust: number | null = null;
	let avgCompliance: number | null = null;

	if (completedCount > 0) {
		let totalDuration = 0;
		let totalTrust = 0;
		let totalCompliance = 0;
		let trustCount = 0;
		let complianceCount = 0;

		for (const s of completedSessions) {
			if (s.endedAt && s.createdAt) {
				totalDuration += (s.endedAt.getTime() - s.createdAt.getTime()) / 1000;
			}
			const metrics = s.finalMetrics as Record<string, number> | null;
			if (metrics?.trust !== undefined) {
				totalTrust += metrics.trust;
				trustCount++;
			}
			if (metrics?.compliance !== undefined) {
				totalCompliance += metrics.compliance;
				complianceCount++;
			}
		}

		avgDuration = totalDuration / completedCount;
		avgTrust = trustCount > 0 ? totalTrust / trustCount : null;
		avgCompliance = complianceCount > 0 ? totalCompliance / complianceCount : null;
	}

	const response: IScenarioStatsResponse = {
		scenarioId: id,
		totalSessions,
		completedSessions: completedCount,
		completionRate: totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0,
		averageDuration: avgDuration,
		averageMetrics: {
			trust: avgTrust?.toString() || null,
			compliance: avgCompliance?.toString() || null,
		},
	};

	return reply.send(response);
}

// get scenario leaderboard
async function getScenarioLeaderboard(
	request: FastifyRequest<{Params: {id: string}; Querystring: {limit?: string}}>,
	reply: FastifyReply
) {
	const {id} = request.params;
	const limit = Math.min(parseInt(request.query.limit || '10', 10), 100);
	const scenarioId = BigInt(id);

	// get completed sessions with user data
	const sessions = await prisma.session.findMany({
		where: {
			scenarioId,
			status: 'COMPLETED',
		},
		include: {
			patient: {
				include: {
					settings: {select: {avatar: true}},
				},
			},
		},
		take: limit * 2, // get more than needed to sort properly
	});

	// sort and build leaderboard
	const sorted = sessions
		.filter((s) => s.patient)
		.map((s) => {
			const metrics = s.finalMetrics as Record<string, number> | null;
			const duration = s.endedAt && s.createdAt 
				? Math.floor((s.endedAt.getTime() - s.createdAt.getTime()) / 1000)
				: 0;
			return {
				session: s,
				trust: metrics?.trust || 0,
				stress: metrics?.stress || 0,
				compliance: metrics?.compliance || 0,
				duration,
			};
		})
		.sort((a, b) => {
			// sort by trust DESC, stress ASC, duration ASC
			if (b.trust !== a.trust) return b.trust - a.trust;
			if (a.stress !== b.stress) return a.stress - b.stress;
			return a.duration - b.duration;
		})
		.slice(0, limit);

	const leaderboard: IScenarioLeaderboardEntry[] = sorted.map((entry, index) => ({
		rank: index + 1,
		userId: entry.session.patientId!.toString(),
		displayName: entry.session.patient!.username,
		avatarUrl: entry.session.patient!.settings?.avatar || undefined,
		metrics: {
			trust: entry.trust,
			stress: entry.stress,
			compliance: entry.compliance,
		},
		duration: entry.duration,
		completedAt: entry.session.endedAt!,
	}));

	const response: IScenarioLeaderboardResponse = {
		scenarioId: id,
		leaderboard,
	};

	return reply.send(response);
}

// register routes
export async function scenarioRoutes(fastify: FastifyInstance) {
	fastify.get('/', listScenarios);
	fastify.get('/:id', getScenario);
	fastify.get('/:id/stats', getScenarioStats);
	fastify.get('/:id/leaderboard', getScenarioLeaderboard);
}
