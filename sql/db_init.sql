-- SQL code to init the transcendance database

CREATE TABLE users (
	user_id			int(11)	AUTOINCREMENT PRIMARY KEY NOT NULL;
	user_username	varchar(255) NOT NULL;
	user_email		varchar(255) NOT NULL;
	user_dob		date() NOT NULL;
	user_settings	int(11) NOT NULL;
);

CREATE TABLE user_keys (
	key_id int(11) AUTO_INCREMENT PRIMARY KEY NOT NULL,
	key_userid int(11) NOT NULL UNIQUE,
	key_token varchar(255) NOT NULL,
	key_status bool NOT NULL
);

CREATE TABLE settings (
	settings_id		int(11)	AUTOINCREMENT PRIMARY KEY NOT NULL;
	settings_colour	
	settings_
);

CREATE TABLE tournaments (
	tournament_id		int(11) AUTOINCREMENT PRIMARY KEY NOT NULL;
	tournament_name		varchar(255) NOT NULL;
	tournament_date_start timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL;
	tournament_date_end	timestamp;
	tournament_winner	int(11) NOT NULL;
	tournament_userlist	int(11) NOT NULL;
);

CREATE TABLE userlist (
	userlist_id				int(11) PRIMARY KEY AUTOINCREMENT NOT NULL;
	userlist_tournament_id	int(11) NOT NULL;
	userlist_usercount		int(2) NOT NULL;
	userlist_user1			int(11) NOT NULL;
	userlist_user2			int(11) NOT NULL;
	userlist_user3			int(11);
	userlist_user4			int(11);
	userlist_user5			int(11);
	userlist_user6			int(11);
	userlist_user7			int(11);
	userlist_user8			int(11);
	userlist_user9			int(11);
	userlist_user10			int(11);
);

CREATE TABLE matches (
	match_id			int(11) AUTOINCREMENT PRIMARY KEY NOT NULL;
	match_tournament_id	int(11) NOT NULL;
	match_user1_id		int(11) NOT NULL;
	match_user2_id		int(11) NOT NULL;
	match_winner		int(11);
	match_date_start	timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL;
	match_date_end		timestamp;
);

ALTER TABLE users ADD FOREIGN KEY (user_settings) REFERENCES settings (settings_id);

ALTER TABLE tournaments ADD FOREIGN KEY (tournament_userlist) REFERENCES userlist (userlist_id);

ALTER TABLE userlist ADD FOREIGN KEY (userlist_user1, userlist_user2, userlist_user3, userlist_user4, userlist_user5, userlist_user6, userlist_user7, userlist_user8, userlist_user9, userlist_user10)
REFERENCES users (user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);

ALTER TABLE matches ADD FOREIGN KEY (match_tournament_id) REFERENCES tournaments (tournament_id);
ALTER TABLE matches ADD FOREIGN KEY (match_user1_id, match_user2_id) REFERENCES users (user_id, user_id);

ALTER TABLE user_keys ADD FOREIGN KEY (key_userid) REFERENCES users (user_id);

-- API for the DB

-- stats for W/L per user

-- select all matches for a user $userid
SELECT COUNT(m.match_id) AS matchcount FROM users AS u
LEFT JOIN matches AS m ON u.user_id = m.match_user1_id
LEFT JOIN matches AS m2 ON u.user_id = m2.match_user2_id 
WHERE u.user_id = $userid
AND m.match_date_end NOT NULL
AND m2.match_date_end NOT NULL;

SELECT COUNT(m.match_id) AS matchwins FROM users AS u
JOIN matches AS m ON u.user_id = m.match_winner
WHERE u.user_id = $userid
AND m.match_date_end NOT NULL;
