-- init script db

-- Create databases for each service with respective owners
-- Note: This script runs during first initialization, so IF NOT EXISTS is not needed
-- but kept for documentation purposes
CREATE DATABASE user_db;
CREATE DATABASE auth_db;
CREATE DATABASE game_db;
CREATE DATABASE chat_db;
