import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

const achievements = [
	// pong achievements
	{
		code: 'FIRST_PONG',
		name: 'First Rally',
		description: 'Play your first Pong match',
		xpReward: 50,
		rarity: 'COMMON' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_MATCH_COUNT', count: 1},
	},
	{
		code: 'PONG_10_MATCHES',
		name: 'Regular Player',
		description: 'Play 10 Pong matches',
		xpReward: 100,
		rarity: 'UNCOMMON' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_MATCH_COUNT', count: 10},
	},
	{
		code: 'PONG_50_MATCHES',
		name: 'Pong Veteran',
		description: 'Play 50 Pong matches',
		xpReward: 250,
		rarity: 'RARE' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_MATCH_COUNT', count: 50},
	},
	{
		code: 'PONG_LOCAL_5',
		name: 'Local Champion',
		description: 'Play 5 local Pong matches',
		xpReward: 75,
		rarity: 'UNCOMMON' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_LOCAL_MATCH_COUNT', count: 5},
	},
	{
		code: 'BEAT_HARD_AI',
		name: 'AI Challenger',
		description: 'Win against the Hard AI',
		xpReward: 150,
		rarity: 'RARE' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_WIN_HARD_AI'},
	},
	{
		code: 'FLAWLESS_VICTORY',
		name: 'Flawless Victory',
		description: 'Win a Pong match without losing any points',
		xpReward: 200,
		rarity: 'EPIC' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_FLAWLESS_WIN'},
	},
	{
		code: 'PONG_STREAK_5',
		name: 'Winning Streak',
		description: 'Win 5 Pong matches in a row',
		xpReward: 175,
		rarity: 'RARE' as const,
		category: 'pong',
		conditionJson: {eventType: 'PONG_MATCH_SAVED', type: 'PONG_WIN_STREAK', count: 5},
	},
	
	// breathe achievements
	{
		code: 'FIRST_BREATHE',
		name: 'First Breath',
		description: 'Complete your first breathing session',
		xpReward: 50,
		rarity: 'COMMON' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'BREATHE_SESSION_COUNT', count: 1},
	},
	{
		code: 'BREATHE_10',
		name: 'Mindful Breather',
		description: 'Complete 10 breathing sessions',
		xpReward: 100,
		rarity: 'UNCOMMON' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'BREATHE_SESSION_COUNT', count: 10},
	},
	{
		code: 'BREATHE_50',
		name: 'Breathing Expert',
		description: 'Complete 50 breathing sessions',
		xpReward: 250,
		rarity: 'RARE' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'BREATHE_SESSION_COUNT', count: 50},
	},
	{
		code: 'BREATHE_5_MIN',
		name: 'Deep Breath',
		description: 'Complete a 5-minute breathing session',
		xpReward: 75,
		rarity: 'UNCOMMON' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'BREATHE_DURATION_MIN', duration: 300},
	},
	{
		code: 'BREATHE_10_MIN',
		name: 'Zen Master',
		description: 'Complete a 10-minute breathing session',
		xpReward: 150,
		rarity: 'RARE' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'BREATHE_DURATION_MIN', duration: 600},
	},
	{
		code: 'STRESS_REDUCTION_20',
		name: 'Stress Relief',
		description: 'Reduce your stress level by 20% in a single session',
		xpReward: 100,
		rarity: 'UNCOMMON' as const,
		category: 'breathe',
		conditionJson: {eventType: 'BREATHE_SESSION_SAVED', type: 'STRESS_REDUCTION', amount: 20},
	},
	
	// social achievements
	{
		code: 'FIRST_FRIEND',
		name: 'Social Butterfly',
		description: 'Make your first friend',
		xpReward: 50,
		rarity: 'COMMON' as const,
		category: 'social',
		conditionJson: {eventType: 'FRIEND_ACCEPTED', type: 'FRIEND_COUNT', count: 1},
	},
	{
		code: 'FIVE_FRIENDS',
		name: 'Social Circle',
		description: 'Have 5 friends',
		xpReward: 100,
		rarity: 'UNCOMMON' as const,
		category: 'social',
		conditionJson: {eventType: 'FRIEND_ACCEPTED', type: 'FRIEND_COUNT', count: 5},
	},
	{
		code: 'FIRST_MESSAGE',
		name: 'Conversation Starter',
		description: 'Send your first message',
		xpReward: 25,
		rarity: 'COMMON' as const,
		category: 'social',
		conditionJson: {eventType: 'CHAT_MESSAGE_SENT', type: 'CHAT_MESSAGE_COUNT', count: 1},
	},
	
	// shop achievements
	{
		code: 'SHOPPING_ADDICT',
		name: 'Shopping Addict',
		description: 'Buy 3 items',
		xpReward: 150,
		rarity: 'UNCOMMON' as const,
		category: 'shop',
		conditionJson: {eventType: 'SHOP_SCENE_COMPLETE', type: 'SHOP_3_ITEMS', count: 1},
	},
	{
		code: 'SHOPPING_JUST_ADDICT',
		name: 'Just An Addict',
		description: 'Maybe reconsider your choices while shopping to improve your mental health',
		xpReward: 250,
		rarity: 'RARE' as const,
		category: 'shop',
		conditionJson: {eventType: 'SHOP_SCENE_COMPLETE', type: 'SHOP_ADDICTION', count: 1},
	},
	
	// level achievements
	{
		code: 'REACH_LEVEL_5',
		name: 'Rising Star',
		description: 'Reach level 5',
		xpReward: 100,
		rarity: 'UNCOMMON' as const,
		category: 'progress',
		conditionJson: {eventType: 'LEVEL_UP', type: 'LEVEL_REACHED', level: 5},
	},
	{
		code: 'REACH_LEVEL_10',
		name: 'Dedicated Player',
		description: 'Reach level 10',
		xpReward: 200,
		rarity: 'RARE' as const,
		category: 'progress',
		conditionJson: {eventType: 'LEVEL_UP', type: 'LEVEL_REACHED', level: 10},
	},
	{
		code: 'REACH_LEVEL_25',
		name: 'Wellness Warrior',
		description: 'Reach level 25',
		xpReward: 500,
		rarity: 'EPIC' as const,
		category: 'progress',
		conditionJson: {eventType: 'LEVEL_UP', type: 'LEVEL_REACHED', level: 25},
	},
	{
		code: 'REACH_LEVEL_50',
		name: 'Transcendence Master',
		description: 'Reach level 50',
		xpReward: 1000,
		rarity: 'LEGENDARY' as const,
		category: 'progress',
		conditionJson: {eventType: 'LEVEL_UP', type: 'LEVEL_REACHED', level: 50},
	},

	// coffee achievements
	{
		code: 'COFFEE_DONT_CARE',
		name: 'Don\'t Care',
		description: 'Mark all thoughts as NOT IMPORTANT',
		xpReward: 200,
		rarity: 'RARE' as const,
		category: 'coffee',
		conditionJson: {eventType: 'COFFEE_SCENE_COMPLETE', type: 'COFFEE_OUTCOME', outcome: 'ALL_NOT_IMPORTANT'},
	},
	{
		code: 'COFFEE_EVERYTHING_IMPORTANT',
		name: 'Everything Is Important',
		description: 'Mark all thoughts as IMPORTANT',
		xpReward: 200,
		rarity: 'RARE' as const,
		category: 'coffee',
		conditionJson: {eventType: 'COFFEE_SCENE_COMPLETE', type: 'COFFEE_OUTCOME', outcome: 'ALL_IMPORTANT'},
	},
	{
		code: 'COFFEE_BALANCED',
		name: 'Balanced Thoughts',
		description: 'Find balance',
		xpReward: 150,
		rarity: 'UNCOMMON' as const,
		category: 'coffee',
		conditionJson: {eventType: 'COFFEE_SCENE_COMPLETE', type: 'COFFEE_OUTCOME', outcome: 'BALANCED'},
	},
	{
		code: 'COFFEE_SWITZERLAND',
		name: 'Switzerland Thoughts',
		description: 'You can always be neutral',
		xpReward: 200,
		rarity: 'RARE' as const,
		category: 'coffee',
		conditionJson: {eventType: 'COFFEE_SCENE_COMPLETE', type: 'COFFEE_OUTCOME', outcome: 'NEUTRAL'},
	},

	// Hospital achievements
	{
		code: 'PATIENT_SAVED',
		name: 'Patient Saved',
		description: 'Save your first patient',
		xpReward: 200,
		rarity: 'UNCOMMON' as const,
		category: 'hospital',
		conditionJson: {eventType: 'HOSPITAL_SCENE_COMPLETE', type: 'HOSPITAL_PATIENTS_SAVED', count: 1},
	},
	{
		code: 'PATIENT_THREE',
		name: 'I Can Save Them All',
		description: 'Save all the patients',
		xpReward: 500,
		rarity: 'LEGENDARY' as const,
		category: 'hospital',
		conditionJson: {eventType: 'HOSPITAL_SCENE_COMPLETE', type: 'HOSPITAL_ALL_SAVED'},
	},
];

async function main() {
	console.log('Seeding achievements...');

	for (const achievement of achievements) {
		await prisma.achievement.upsert({
			where: {code: achievement.code},
			update: {
				name: achievement.name,
				description: achievement.description,
				xpReward: achievement.xpReward,
				rarity: achievement.rarity,
				category: achievement.category,
				conditionJson: achievement.conditionJson,
			},
			create: achievement,
		});
		console.log(`Upserted achievement: ${achievement.code}`);
	}

	console.log('Seeding complete!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
