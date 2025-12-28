import {PrismaClient} from '@prisma/client';
import {readFileSync, existsSync} from 'fs';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

const getDatabaseUrl = (): string => {
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	const user		= process.env.DB_USER	|| 'root_admin';
	const host		= process.env.DB_HOST	|| 'postgres';
	const port		= process.env.DB_PORT	|| '5432';
	const database	= process.env.DB_NAME	|| 'game_db';

	// if var DB_PASSWORD_FILE set then read from file
	let password = process.env.DB_PASSWORD || '';
	const passwordFile = process.env.DB_PASSWORD_FILE;
	if (passwordFile && existsSync(passwordFile)) {
		password = readFileSync(passwordFile, 'utf-8').trim();
	}

	// encode password for special chars
	const encodedPassword = encodeURIComponent(password);

	return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' 
			? ['query', 'error', 'warn'] 
			: ['error'],
		datasources: {
			db: {
				url: getDatabaseUrl(),
			},
		},
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

export default prisma;
