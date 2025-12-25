import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db';
import { IScenario, IScenarioListResponse, IScenarioStatsResponse, IScenarioLeaderboardResponse, IScenarioLeaderboardEntry } from '@speak-up/shared';

// list all scenarios
async function listScenarios(request: FastifyRequest, reply: FastifyReply) {
	const result = await query<{
		id: string;
		title: string;
		description: string;
		difficulty: string;
		estimated_duration: number;
		created_at: Date;
		updated_at: Date;
	}>(`
		SELECT id, title, description, difficulty, estimated_duration, created_at, updated_at
		FROM scenarios
		ORDER BY created_at DESC
	`);

	const scenarios = result.rows.map(row => ({
		id: row.id,
		title: row.title,
		description: row.description,
		difficulty: row.difficulty as IScenario['difficulty'],
		estimatedDuration: row.estimated_duration,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));

	const response: IScenarioListResponse = { scenarios };
	return reply.send(response);
}

// get scenario details
async function getScenario(
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply
) {
	const { id } = request.params;

	const result = await query<{
		id: string;
		title: string;
		description: string;
		difficulty: string;
		estimated_duration: number;
		scenario_logic_tree: unknown;
		scenario_version: number;
		created_at: Date;
		updated_at: Date;
	}>(`
		SELECT id, title, description, difficulty, estimated_duration, 
		       scenario_logic_tree, scenario_version, created_at, updated_at
		FROM scenarios
		WHERE id = $1
	`, [id]);

	if (result.rows.length === 0) {
		return reply.status(404).send({ error: 'Scenario not found' });
	}

	const row = result.rows[0];
	const scenario: IScenario = {
		id: row.id,
		title: row.title,
		description: row.description,
		difficulty: row.difficulty as IScenario['difficulty'],
		estimatedDuration: row.estimated_duration,
		graphData: row.scenario_logic_tree as IScenario['graphData'],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};

	return reply.send(scenario);
}

// get scenario statistics
async function getScenarioStats(
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply
) {
	const { id } = request.params;

	const result = await query<{
		total_sessions: string;
		completed_sessions: string;
		avg_duration: string | null;
		avg_trust: string | null;
		avg_compliance: string | null;
	}>(`
		SELECT 
			COUNT(*) as total_sessions,
			COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_sessions,
			AVG(EXTRACT(EPOCH FROM (ended_at - created_at))) FILTER (WHERE status = 'COMPLETED') as avg_duration,
			AVG((final_metrics->>'trust')::numeric) FILTER (WHERE status = 'COMPLETED') as avg_trust,
			AVG((final_metrics->>'compliance')::numeric) FILTER (WHERE status = 'COMPLETED') as avg_compliance
		FROM sessions
		WHERE scenario_id = $1
	`, [id]);

	const row = result.rows[0];
	const totalSessions = parseInt(row.total_sessions, 10);
	const completedSessions = parseInt(row.completed_sessions, 10);

	const response: IScenarioStatsResponse = {
		scenarioId: id,
		totalSessions,
		completedSessions,
		completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
		averageDuration: row.avg_duration ? parseFloat(row.avg_duration) : null,
		averageMetrics: {
			trust: row.avg_trust,
			compliance: row.avg_compliance,
		},
	};

	return reply.send(response);
}

// get scenario leaderboard
async function getScenarioLeaderboard(
	request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
	reply: FastifyReply
) {
	const { id } = request.params;
	const limit = Math.min(parseInt(request.query.limit || '10', 10), 100);

	const result = await query<{
		user_id: string;
		display_name: string;
		avatar_url: string | null;
		trust: number;
		stress: number;
		compliance: number;
		duration: number;
		completed_at: Date;
	}>(`
		SELECT 
			s.patient_id as user_id,
			COALESCE(u.display_name, u.user_username) as display_name,
			u.avatar_url,
			(s.final_metrics->>'trust')::int as trust,
			(s.final_metrics->>'stress')::int as stress,
			(s.final_metrics->>'compliance')::int as compliance,
			EXTRACT(EPOCH FROM (s.ended_at - s.created_at))::int as duration,
			s.ended_at as completed_at
		FROM sessions s
		JOIN users u ON s.patient_id = u.user_id
		WHERE s.scenario_id = $1 AND s.status = 'COMPLETED'
		ORDER BY (s.final_metrics->>'trust')::int DESC, 
		         (s.final_metrics->>'stress')::int ASC,
		         EXTRACT(EPOCH FROM (s.ended_at - s.created_at)) ASC
		LIMIT $2
	`, [id, limit]);

	const leaderboard: IScenarioLeaderboardEntry[] = result.rows.map((row, index) => ({
		rank: index + 1,
		userId: row.user_id.toString(),
		displayName: row.display_name,
		avatarUrl: row.avatar_url || undefined,
		metrics: {
			trust: row.trust,
			stress: row.stress,
			compliance: row.compliance,
		},
		duration: row.duration,
		completedAt: row.completed_at,
	}));

	const response: IScenarioLeaderboardResponse = {
		scenarioId: id,
		leaderboard,
	};

	return reply.send(response);
}

// register routes
export async function scenarioRoutes(fastify: FastifyInstance) {
	fastify.get('/scenarios', listScenarios);
	fastify.get('/scenarios/:id', getScenario);
	fastify.get('/scenarios/:id/stats', getScenarioStats);
	fastify.get('/scenarios/:id/leaderboard', getScenarioLeaderboard);
}
