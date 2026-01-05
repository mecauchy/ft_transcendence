-- SQL code to init the transcendance database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM('PATIENT', 'DOCTOR', 'ADMIN');
CREATE TYPE friend_status AS ENUM('PENDING', 'ACCEPTED', 'BLOCKED');
CREATE TYPE pong_mode AS ENUM('AI', 'LOCAL');
CREATE TYPE pong_difficulty AS ENUM('EASY', 'MEDIUM', 'HARD', 'LOCAL');
CREATE TYPE pong_winner AS ENUM('PLAYER', 'AI', 'PLAYER1', 'PLAYER2');
CREATE TYPE session_mode AS ENUM('AI', 'P2P');
CREATE TYPE session_status AS ENUM('WAITING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED');
CREATE TYPE token_status AS ENUM('ACTIVE', 'REVOKED');
CREATE TYPE token_type AS ENUM('REFRESH', 'API');


CREATE TABLE users (
	user_id					BIGSERIAL PRIMARY KEY,
	user_username			VARCHAR(32) UNIQUE NOT NULL,
	user_email				VARCHAR(255) UNIQUE NOT NULL,
	user_password			TEXT,
	user_dob				DATE NOT NULL,
	user_role				user_role NOT NULL DEFAULT 'PATIENT',
	user_twofa_enabled		BOOLEAN NOT NULL DEFAULT FALSE,
	user_twofa_secret		TEXT,
	user_creation_date		TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	user_modification_date	TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_users_email ON users (user_email);
CREATE INDEX idx_users_username ON users (user_username);


CREATE TABLE oauth (
	oauth_id				BIGSERIAL PRIMARY KEY,
	oauth_userid			BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
	oauth_provider			TEXT NOT NULL,
	oauth_provider_userid	TEXT NOT NULL,
	oauth_creation_date		TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	UNIQUE (oauth_provider, oauth_provider_userid)
);


CREATE TABLE user_keys (
	key_id				BIGSERIAL PRIMARY KEY,
	key_userid			BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
	key_token			TEXT NOT NULL,
	key_type			token_type NOT NULL,
	key_status			token_status NOT NULL DEFAULT 'ACTIVE',
	key_creation_date	TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	key_expiry_date		TIMESTAMPTZ
);
CREATE INDEX idx_userkeys_userid ON user_keys (key_userid);
CREATE INDEX idx_userkeys_status ON user_keys (key_status);


CREATE TABLE settings (
	settings_id		BIGSERIAL PRIMARY KEY,
	settings_userid	BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
	settings_avatar	TEXT,
	settings_colour	VARCHAR(32),
	settings_locale	VARCHAR(5) NOT NULL DEFAULT 'fr'
);
CREATE INDEX idx_settings_user ON settings (settings_userid);


CREATE TABLE friends (
	friend_id				BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	friend_userid			BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	friend_status			friend_status NOT NULL DEFAULT 'PENDING',
	friend_creation_date	TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (friend_id, friend_userid)
);
CREATE INDEX idx_friends_friend ON friends (friend_userid);
CREATE INDEX idx_friends_status ON friends (friend_status);

CREATE TABLE game_pong (
	game_pong_id			BIGSERIAL PRIMARY KEY,
	game_pong_player_id		BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
	game_pong_mode			pong_mode NOT NULL,
	game_pong_difficulty	pong_difficulty NOT NULL,
	game_pong_score_1		INTEGER NOT NULL,
	game_pong_score_2		INTEGER NOT NULL,
	game_pong_winner		pong_winner NOT NULL,
	game_pong_started_at	TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	game_pong_ended_at		TIMESTAMPTZ
);

CREATE TABLE game_breathe (
	game_breathe_id			BIGSERIAL PRIMARY KEY,
	game_breathe_player_id	BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
	game_breathe_started_at	TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	game_breathe_ended_at	TIMESTAMPTZ
);

CREATE TABLE scenarios (
	scenario_id				BIGSERIAL PRIMARY KEY,
	scenario_title			TEXT NOT NULL,
	scenario_description	TEXT,
	scenario_logic_tree		JSONB NOT NULL,	-- stores the narrative graph
	scenario_version		INTEGER NOT NULL DEFAULT 1,
	scenario_created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	scenario_updated_at		TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual sessions (Patient <-> Doctor/AI)
CREATE TABLE sessions (
	id				UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	patient_id		BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
	doctor_id		BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
	scenario_id		BIGINT REFERENCES scenarios(scenario_id) ON DELETE RESTRICT,
	mode			session_mode NOT NULL,
	status			session_status NOT NULL DEFAULT 'WAITING',
	created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	ended_at		TIMESTAMPTZ,
	final_metrics	JSONB	-- snapshot: trust, stress, compliance, mood
);

CREATE INDEX idx_sessions_patient ON sessions (patient_id);
CREATE INDEX idx_sessions_doctor ON sessions (doctor_id);
CREATE INDEX idx_sessions_scenario ON sessions (scenario_id);
CREATE INDEX idx_sessions_status ON sessions (status);

-- Event sourcing log: one row per GameEvent
CREATE TABLE event_logs (
	id				BIGSERIAL PRIMARY KEY,
	session_id		UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	sequence_id		INTEGER NOT NULL,
	event_type		TEXT NOT NULL,
	emitter_id		BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
	payload			JSONB NOT NULL,
	created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (session_id, sequence_id)
);

CREATE INDEX idx_event_logs_session_seq ON event_logs (session_id, sequence_id);
CREATE INDEX idx_event_logs_emitter ON event_logs (emitter_id);
CREATE INDEX idx_event_logs_type ON event_logs (event_type);

-- rarity levels for achievements
CREATE TYPE achievement_rarity AS ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- achievement definitions
CREATE TABLE achievements (
	id				UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	code			VARCHAR(64) UNIQUE NOT NULL,  -- e.g., 'FIRST_SESSION', 'PERFECT_10'
	name			VARCHAR(128) NOT NULL,
	description		TEXT NOT NULL,
	icon_url		TEXT,
	xp_reward		INTEGER NOT NULL DEFAULT 0,
	rarity			achievement_rarity NOT NULL DEFAULT 'COMMON',
	category		VARCHAR(64) NOT NULL DEFAULT 'general',
	condition_json	JSONB NOT NULL,  -- JSON defining unlock conditions
	is_hidden		BOOLEAN NOT NULL DEFAULT FALSE,  -- Secret achievements
	created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_achievements_category ON achievements (category);
CREATE INDEX idx_achievements_rarity ON achievements (rarity);

-- user achievement unlocks
CREATE TABLE user_achievements (
	id				UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	user_id			BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	achievement_id	UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
	unlocked_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements (user_id);
CREATE INDEX idx_user_achievements_date ON user_achievements (unlocked_at DESC);

-- xp transaction log
CREATE TABLE xp_logs (
	id				UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	user_id			BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	amount			INTEGER NOT NULL,  -- Can be negative for penalties
	reason			VARCHAR(255) NOT NULL,  -- e.g., 'SESSION_COMPLETE', 'ACHIEVEMENT_UNLOCK'
	session_id		UUID REFERENCES sessions(id) ON DELETE SET NULL,
	created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_logs_user ON xp_logs (user_id);
CREATE INDEX idx_xp_logs_date ON xp_logs (created_at DESC);
CREATE INDEX idx_xp_logs_session ON xp_logs (session_id);

-- gamification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_xp ON users (total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_level ON users (current_level DESC);

INSERT INTO achievements (code, name, description, xp_reward, rarity, category, condition_json) VALUES
	-- ('FIRST_SESSION', 'First Steps', 'Complete your first therapy session', 500, 'COMMON', 'progression', '{"type": "SESSION_COUNT", "eventType": "SESSION_COMPLETE", "count": 1}'),
	-- ('SESSION_5', 'Getting Started', 'Complete 5 therapy sessions', 200, 'COMMON', 'progression', '{"type": "SESSION_COUNT", "eventType": "SESSION_COMPLETE", "count": 5}'),
	-- ('SESSION_25', 'Regular Patient', 'Complete 25 therapy sessions', 500, 'UNCOMMON', 'progression', '{"type": "SESSION_COUNT", "eventType": "SESSION_COMPLETE", "count": 25}'),
	-- ('SESSION_100', 'Dedicated Soul', 'Complete 100 therapy sessions', 1500, 'RARE', 'progression', '{"type": "SESSION_COUNT", "eventType": "SESSION_COMPLETE", "count": 100}'),
	-- ('PERFECT_SESSION', 'Perfect Understanding', 'Complete a session with 90%+ trust and <30% stress', 300, 'UNCOMMON', 'skill', '{"type": "PERFECT_SESSION", "eventType": "SESSION_COMPLETE"}'),
	-- ('STREAK_7', 'Weekly Warrior', 'Play for 7 consecutive days', 400, 'UNCOMMON', 'dedication', '{"type": "STREAK", "eventType": "DAILY_LOGIN", "days": 7}'),
	-- ('STREAK_30', 'Monthly Master', 'Play for 30 consecutive days', 1000, 'RARE', 'dedication', '{"type": "STREAK", "eventType": "DAILY_LOGIN", "days": 30}'),
	-- ('LEVEL_10', 'Rising Star', 'Reach level 10', 0, 'UNCOMMON', 'progression', '{"type": "LEVEL_REACHED", "eventType": "XP_GAINED", "level": 10}'),
	-- ('LEVEL_25', 'Experienced', 'Reach level 25', 0, 'RARE', 'progression', '{"type": "LEVEL_REACHED", "eventType": "XP_GAINED", "level": 25}'),
	-- ('LEVEL_50', 'Veteran', 'Reach level 50', 0, 'EPIC', 'progression', '{"type": "LEVEL_REACHED", "eventType": "XP_GAINED", "level": 50}'),
	-- ('FRIENDS_5', 'Social Butterfly', 'Add 5 friends', 150, 'COMMON', 'social', '{"type": "FRIEND_COUNT", "eventType": "FRIEND_ADDED", "count": 5}'),
	-- ('FRIENDS_25', 'Popular', 'Add 25 friends', 400, 'UNCOMMON', 'social', '{"type": "FRIEND_COUNT", "eventType": "FRIEND_ADDED", "count": 25}'),
	('XP_1000', 'First Milestone', 'Earn 1,000 total XP', 0, 'COMMON', 'progression', '{"type": "TOTAL_XP", "eventType": "XP_GAINED", "xp": 1000}'),
	('XP_10000', 'Ten Thousand Strong', 'Earn 10,000 total XP', 0, 'UNCOMMON', 'progression', '{"type": "TOTAL_XP", "eventType": "XP_GAINED", "xp": 10000}'),
	('XP_100000', 'XP Legend', 'Earn 100,000 total XP', 0, 'LEGENDARY', 'progression', '{"type": "TOTAL_XP", "eventType": "XP_GAINED", "xp": 100000}'),

	-- Pong achievements
	('PONG_FIRST_MATCH', 'First Match!', 'Play your first Pong match.', 50, 'COMMON', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_MATCH_COUNT", "count": 1}'),
	('PONG_5_MATCHES', 'Getting Warm', 'Play 5 Pong matches.', 100, 'COMMON', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_MATCH_COUNT", "count": 5}'),
	('PONG_25_MATCHES', 'Pong Regular', 'Play 25 Pong matches.', 250, 'UNCOMMON', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_MATCH_COUNT", "count": 25}'),
	('PONG_LOCAL_MATCH', 'Couch Rivalry', 'Play a local Pong match.', 50, 'COMMON', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_LOCAL_MATCH_COUNT", "count": 1}'),
	('PONG_HARD_AI_WIN', 'AI Challenger', 'Win a Pong match against HARD AI.', 200, 'RARE', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_WIN_HARD_AI"}'),
	('PONG_HARD_AI_PERFECT', 'Perfect Machine', 'Win 5-0 against HARD AI.', 400, 'EPIC', 'PONG', '{"eventType": "PONG_MATCH_SAVED", "type": "PONG_PERFECT_WIN_HARD_AI"}'),

	-- Breathe achievements
	('BREATHE_1_MIN', 'One Minute Calm', 'Accumulate 1 minute of breathing sessions.', 50, 'COMMON', 'BREATHE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),
	('BREATHE_10_MIN', 'Ten Minutes Calm', 'Accumulate 10 minutes of breathing sessions.', 150, 'UNCOMMON', 'BREATHE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 600}'),
	('BREATHE_1_HOUR', 'Hour of Peace', 'Accumulate 1 hour of breathing sessions.', 500, 'EPIC', 'BREATHE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 3600}'),

-- TODO: UNCOMMENT THIS AND FILL PROPERLY LATER (connect to the games aswell)
	-- -- Coffee achievements
	-- ('COFFEE_DONT_CARE', 'Dont Care', 'You clearly dont care about coffee.', 200, 'RARE', 'COFFEE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),
	-- ('COFFEE_EVERYTHING_IMPORTANT', 'Everything Is Important', 'EVERYTHING IS IMPORTANT.', 200, 'RARE', 'COFFEE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),
	-- ('COFFEE_SWITZERLAND', 'Switzerland Thoughts', 'You have to be more decisive sometimes...', 200, 'RARE', 'COFFEE', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),

	-- -- Shop achievements
	-- ('SHOP_FIRST_PURCHASE', 'First Purchase', 'Make your first purchase in the shop.', 50, 'COMMON', 'SHOP', '{"eventType": "SHOP_PURCHASE", "type": "SHOP_PURCHASE_COUNT", "count": 1}'),
	-- ('SHOP_BIG_SPENDER', 'Big Spender', 'Make 10 purchases in the shop.', 150, 'UNCOMMON', 'SHOP', '{"eventType": "SHOP_PURCHASE", "type": "SHOP_PURCHASE_COUNT", "count": 10}'),
	-- ('SHOP_ADDICT', 'Shopping Addict', 'Only purchase addictive products in the shop.', 50, 'RARE', 'SHOP', '{"eventType": "SHOP_PURCHASE", "type": "SHOP_PURCHASE_COUNT", "count": 10}'),

	-- -- Hospital achievements
	-- ('PATIENT_SAVED', 'Patient Saved', 'Save your first patient.', 500, 'EPIC', 'HOSPITAL', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),
	-- ('PATIENT_THREE', 'I Can Save Them All', 'Save all the patients.', 500, 'LEGENDARY', 'HOSPITAL', '{"eventType": "BREATHE_SESSION_SAVED", "type": "BREATHE_TOTAL_SECONDS", "seconds": 60}'),

	-- Social achievements
	('FRIEND_FIRST', 'Hello Friend', 'Make your first friend.', 50, 'COMMON', 'SOCIAL', '{"eventType": "FRIEND_ACCEPTED", "type": "FRIEND_COUNT", "count": 1}'),
	('FRIEND_5', 'Friendly', 'Make 5 friends.', 150, 'UNCOMMON', 'SOCIAL', '{"eventType": "FRIEND_ACCEPTED", "type": "FRIEND_COUNT", "count": 5}'),
	('FRIEND_15', 'Social Circle', 'Make 15 friends.', 400, 'RARE', 'SOCIAL', '{"eventType": "FRIEND_ACCEPTED", "type": "FRIEND_COUNT", "count": 15}'),
	('BLOCK_FIRST', 'Boundaries', 'Block 1 person.', 25, 'COMMON', 'SOCIAL', '{"eventType": "USER_BLOCKED", "type": "BLOCK_COUNT", "count": 1}'),

	-- Chat achievements
	('CHAT_FIRST_MESSAGE', 'First Words', 'Send your first chat message.', 25, 'COMMON', 'CHAT', '{"eventType": "CHAT_MESSAGE_SENT", "type": "CHAT_MESSAGE_COUNT", "count": 1}')
	ON CONFLICT (code) DO NOTHING;
