-- API for the DB

--------- USER MANAGEMENT ---------
-- User creation
INSERT INTO users (
	user_username, user_password, user_email, user_dob, user_creation_date, user_modification_date, user_twofa_enabled, user_twofa_secret
) VALUES (
	:username, :hashedpassword, :email, :dob, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, NULL
);

-- Select user by id
SELECT *
FROM users
WHERE user_id = :userid;

-- Select user by username or email
SELECT *
FROM users
WHERE user_email = :loginval
OR user_username = :loginval;

-- Update user settings
UPDATE settings
SET settings_avatar = :avatar_url,
	settings_colour = :colour,
	settings_locale = :locale
WHERE settings_userid = :userid;

-- Update user password
UPDATE users
SET user_password = :hashedpassword,
	user_modification_date = CURRENT_TIMESTAMP
WHERE user_id = :userid;

-- Enable 2FA
UPDATE users
SET user_twofa_enabled = 1,
	user_twofa_secret = :twofa_secret
	user_modification_date = CURRENT_TIMESTAMP
WHERE user_id = :userid;

-- Disable 2FA
UPDATE users
SET user_twofa_enabled = 0,
	user_twofa_secret = NULL
	user_modification_date = CURRENT_TIMESTAMP
WHERE user_id = :userid;


--------- OAUTH & SESSION ---------
-- Link OAuth provider
INSERT INTO oauth (oauth_userid, oauth_provider, oauth_provider_userid, oauth_creation_date)
VALUES (:userid, :oauthprovider, :oauthuserid, CURRENT_TIMESTAMP);

-- Get user provider + poverider uid
SELECT u.*
FROM users AS u
JOIN oauth AS oa ON oa.oauth_userid = u.user_id
WHERE oa.oauth_provider = :oauthprovider
AND oa.oauth_provider_userid = :oauthuserid;

-- Delete oauth
DELETE FROM oauth WHERE oauth_userid = :user_id;


--------- FRIENDS ---------
-- Send friend request between friendid and userid
INSERT INTO friends (friend_id, friend_userid, friend_status, friend_creation_date)
VALUES (:friend_id, :user_id, 'pending', CURRENT_TIMESTAMP);

-- Accept friend request
UPDATE friends
SET friend_status = 'accepted'
WHERE friend_userid = :friend_id
AND friend_id = :user_id
AND friend_status = 'pending';

-- Remove friend
DELETE FROM friends
WHERE (friend_userid = :user_id AND friend_id = :friend_id)
OR (friend_userid = :friend_id AND friend_id = :user_id)

-- List current friends
SELECT u.*
FROM friends AS f
JOIN users AS u ON (
	(f.friend_userid = :user_id AND f.friend_id = :friend_id)
OR (f.friend_userid = :friend_id AND f.friend_id = :user_id)
)
WHERE f.friend_status = 'accepted';

-- List pending friend requests (from user)
SELECT u.*
FROM friends AS f
JOIN users AS u ON f.friend_userid = :user_id
WHERE f.friend_status = 'pending';

-- List pending friend requests (from others)
SELECT u.*
FROM friends AS f
JOIN users AS u ON f.friend_id = :user_id
WHERE f.friend_status = 'pending';


--------- TOURNAMENTS ---------
-- Create a tournament
INSERT INTO tournaments (tournament_name, tournament_status, tournament_date_start)
VALUES (:t_name, 'upcoming', CURRENT_TIMESTAMP);

-- Start a tournament
UPDATE tournaments
SET tournament_status = 'ongoing'
	tournament_date_start = CURRENT_TIMESTAMP
WHERE tournament_id = :tournament_id
AND tournament_status = 'upcoming';

-- Finish tournament and set a winner
UPDATE tournaments
SET tournament_status = 'ended'
	tournament_date_end = CURRENT_TIMESTAMP
WHERE tournament_id = :tournament_id
AND tournament_status = 'ongoing';

-- List tournaments (by status, most recent first)
SELECT *
FROM tournaments
WHERE tournament_status = :tournament_status
ORDER BY tournament_date_start DESC;

-- List tournaments where user has participated
SELECT t.*
FROM tournaments AS t
JOIN userlist AS ul ON ul.userlist_tournament_id = t.tournament_id
WHERE ul.userlist_userid = :user_id
ORDER BY t.tournament_date_start DESC;

-- List tournaments that user won
SELECT *
FROM tournaments
WHERE tournament_winner = :user_id
ORDER BY tournament_date_start DESC;

-- Add a player to a tournament
INSERT INTO userlist (userlist_tournament_id, userlist_userid)
VALUES (:tournament_id, :user_id);

-- List all players in a tournament
SELECT ul.*, t.tournament_date_start AS tournament_date
FROM userlist AS ul
JOIN tournaments AS t ON t.tournament_id = ul.userlist_tournament_id
WHERE ul.userlist_tournament_id = :tournament_id
ORDER BY tournament_date DESC;

-- Get tournament player by userid to link matches
SELECT *
FROM userlist
WHERE userlist_tournament_id = :tournament_id
AND userlist_userid = :user_id;


--------- MATCHMAKING ---------
-- Create a match
INSERT INTO matches (match_tournament_id, match_status, match_user1_id, match_user2_id, match_date_start)
VALUES (:tournament_id, 'upcoming', :userid1, :userid2, CURRENT_TIMESTAMP);

-- Start a match
UPDATE matches
SET match_status = 'ongoing',
	match_date_start = CURRENT_TIMESTAMP
WHERE match_id = :match_id
AND match_status = 'upcoming';

-- Update match result
UPDATE matches
SET match_status = 'ended',
	match_date_end = CURRENT_TIMESTAMP,
	match_user1_score = :user1_score,
	match_user2_score = :user2_score,
	match_winner = :winner
WHERE match_id = :match_id
AND match_status = 'ongoing';

-- Forfeit a match
UPDATE matches
SET match_status = 'forfeit',
	match_date_end = CURRENT_TIMESTAMP,
	match_winner = :winner
WHERE match_id = :match_id
AND match_status = 'ongoing';

-- List all matches of a tournament
SELECT m.*
FROM matches AS m
JOIN userlist ul1 ON m.match_user1_id = ul1.userlist_userid
JOIN userlist ul2 ON m.match_user1_id = ul2.userlist_userid
WHERE m.match_tournament_id = :tournament_id
ORDER BY m.match_id;


--------- STATISTICS ---------
-- select all matches for a user
SELECT COUNT(m.match_id) AS matchcount 
FROM users AS u
LEFT JOIN matches AS m ON u.user_id = m.match_user1_id
LEFT JOIN matches AS m2 ON u.user_id = m2.match_user2_id 
WHERE u.user_id = $userid
AND (m.match_status = 'ended'
OR m2.match_status = 'ended');

-- Select all matches won by user
SELECT COUNT(m.match_id) AS matchwins
FROM users AS u
JOIN matches AS m ON u.user_id = m.match_winner
WHERE u.user_id = $userid
AND m.match_status = 'ended';

-- User match history
SELECT m.id, m.tournament_id, m.started_at, m.ended_at, m.score_p1, m.score_p2, 
CASE WHEN m.winner_player_id = ul_self.id THEN 1 ELSE 0 END AS is_win
FROM matches AS m
JOIN userlist ul1 ON m.match_user1_id = ul1.userlist_userid
JOIN userlist ul2 ON m.match_user2_id = ul2.userlist_userid
JOIN userlist AS ul_self
	ON (ul_self.userlist_id = ul1.userlist_id AND ul1.userlist_userid = :user_id)
	OR (ul_self.userlist_id = ul2.userlist_id AND ul2.userlist_userid = :user_id)
JOIN userlist AS ul_opp
	ON (ul_opp.userlist_id = ul1.userlist_id AND ul_self.userlist_id = ul2.userlist_id)
	OR (ul_opp.userlist_id = ul2.userlist_id AND ul_self.userlist_id = ul1.userlist_id)
WHERE m.match_status = 'ended'
ORDER BY m.match_date_end DESC
LIMIT :limit OFFSET :offset;

-- Tournament leaderboard
SELECT
	ul.userlist_userid AS tournament_player_id,
	u.username,
	SUM(CASE WHEN m.match_winner = ul.userlist_userid THEN 1 ELSE 0 END) AS wins,
	COUNT(m.match_id) AS games_played
FROM userlist AS ul
LEFT JOIN users AS u ON ul.userlist_userid = u.user_id
LEFT JOIN matches AS m
  ON (m.match_user1_id = ul.userlist_userid OR m.match_user2_id = ul.userlist_userid)
 AND m.match_status = 'ended'
WHERE ul.userlist_tournament_id = :tournament_id
GROUP BY ul.userlist_userid, u.user_username
ORDER BY wins DESC, games_played DESC;

-- Update stats table
UPDATE stats
SET stat_games_played = stat_games_played + 1,
	stat_games_won = stat_games_won + :won,
	stat_games_lost = stat_games_lost + :lost,
	stat_points_scored = stat_points_scored + :points_scored,
	stat_points_conceded = stat_points_conceded + :points_conceded
WHERE stat_userid = :user_id;

-- Update tournament stats
UPDATE stats
SET stat_tournaments_played = stat_tournaments_played + 1,
	stat_tournaments_won = stat_tournaments_won + :won
WHERE stat_userid = :user_id;


--------- SETTINGS ---------
-- Change language
UPDATE settings
SET settings_locale = :locale
WHERE settings_userid = :user_id;