-- init script db

-- Create users for each service
CREATE USER "user_service" WITH PASSWORD 'user_service_pass';
CREATE USER "auth_service" WITH PASSWORD 'auth_service_pass';
CREATE USER "game_service" WITH PASSWORD 'game_service_pass';
CREATE USER "chat_service" WITH PASSWORD 'chat_service_pass';

-- Create databases for each service with respective owners
CREATE DATABASE "user_db" OWNER "user_service";
CREATE DATABASE "auth_db" OWNER "auth_service";
CREATE DATABASE "game_db" OWNER "game_service";
CREATE DATABASE "chat_db" OWNER "chat_service";