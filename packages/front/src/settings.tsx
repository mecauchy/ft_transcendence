import {useState} from 'react'
import {useAuth} from './contexts/AuthContext'
import { api } from './api/client';

function Settings() {
	const { user, refreshUser } = useAuth();
	const [username, setUsername] = useState(user?.username || '');
	const [email, setEmail] = useState(user?.email || '');
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
	const [language, setLanguage] = useState<'en' | 'fr'>('en');

	const handleUpdateProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage(null);

		try {
			await api.updateProfile({
				username: username !== user?.username ? username : undefined,
				email: email !== user?.email ? email : undefined,
				preferences: {
					language: language,
				},
			});
			setMessage({type: 'success', text: 'Profile updated successfully!'});
			// Refresh user data in context
			await refreshUser();
		} catch (error: unknown) {
			const err = error as {message?: string};
			setMessage({type: 'error', text: err.message || 'Failed to update profile'});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="max-w-md mx-auto mt-32 p-6 bg-white/10 rounded-lg shadow-md">
			<h1 className="text-2xl font-bold mb-6">Settings</h1>
			
			{message && (
				<div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
					{message.text}
				</div>
			)}

			<form onSubmit={handleUpdateProfile} className="space-y-4">
				<div>
					<label htmlFor="username" className="block text-sm font-medium mb-1">
						Username
					</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Enter your username"
					/>
				</div>

				<div>
					<label htmlFor="email" className="block text-sm font-medium mb-1">
						Email
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Enter your email"
					/>
				</div>

				<div>
					<label htmlFor="language" className="block text-sm font-medium mb-1">
						Language
					</label>
					<select
						id="language"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={language}
						onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}
					>
						<option value="en">English (en)</option>
						<option value="fr">French (fr)</option>
					</select>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? 'Saving...' : 'Save Changes'}
				</button>
			</form>
		</div>
	)
}

export default Settings;