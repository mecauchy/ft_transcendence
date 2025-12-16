-- SQL code to init the transcendance database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM('PATIENT', 'DOCTOR', 'ADMIN');
CREATE TYPE friend_status AS ENUM('PENDING', 'ACCEPTED', 'BLOCKED');
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
	oauth_creation_date		TIMESTAMPTZ DEFAULT NOW() NOT NULL

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
	friend_id				BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	friend_userid			BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	friend_status			friend_status NOT NULL DEFAULT 'PENDING',
	friend_creation_date	TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (friend_id, friend_userid)
);
CREATE INDEX idx_friends_friend ON friends (friend_userid);
CREATE INDEX idx_friends_status ON friends (friend_status);


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
	patient_id		BIGINT REFERENCES users(id) ON DELETE SET NULL,
	doctor_id		BIGINT REFERENCES users(id) ON DELETE SET NULL,
	scenario_id		BIGINT REFERENCES scenarios(id) ON DELETE RESTRICT,
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
	emitter_id		BIGINT REFERENCES users(id) ON DELETE SET NULL,
	payload			JSONB NOT NULL,
	created_at		TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (session_id, sequence_id)
);

CREATE INDEX idx_event_logs_session_seq ON event_logs (session_id, sequence_id);
CREATE INDEX idx_event_logs_emitter ON event_logs (emitter_id);
CREATE INDEX idx_event_logs_type ON event_logs (event_type);
	