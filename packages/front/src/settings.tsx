import {useState, useEffect} from 'react'
import {useAuth} from './contexts/AuthContext'
import { api } from './api/client';
import { useTranslation } from 'react-i18next';

function Settings() {
	const { user, refreshUser } = useAuth();
	const { t, i18n } = useTranslation();
	const [username, setUsername] = useState(user?.username || '');
	const [email, setEmail] = useState(user?.email || '');
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
	const [language, setLanguage] = useState<'en' | 'fr' | 'es'>((i18n.language as 'en' | 'fr' | 'es') || 'en');
	const [is2FAEnabled, setIs2FAEnabled] = useState(false);

	// Sync language state with current i18n language when it changes externally
	useEffect(() => {
		const currentLang = i18n.language as 'en' | 'fr' | 'es';
		if (['en', 'fr', 'es'].includes(currentLang)) {
			setLanguage(currentLang);
		}
	}, [i18n.language]);

	const handle2FAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setIs2FAEnabled(e.target.checked);
	}

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newLang = e.target.value as 'en' | 'fr' | 'es';
		setLanguage(newLang);
		// Don't change language immediately - wait for form submit
	}

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
			// Apply the language change after successful API update
			i18n.changeLanguage(language);
			setMessage({type: 'success', text: t('settings.profileUpdated')});
			// Refresh user data in context
			await refreshUser();
		} catch (error: unknown) {
			const err = error as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.updateFailed')});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="max-w-md mx-auto mt-32 p-6 bg-white/10 rounded-lg shadow-md">
			<h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>
			
			{message && (
				<div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
					{message.text}
				</div>
			)}

			<form onSubmit={handleUpdateProfile} className="space-y-4">
				<div>
					<label htmlFor="username" className="block text-sm font-medium mb-1">
						{t('settings.username')}
					</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder={t('settings.enterUsername')}
					/>
				</div>

				<div>
					<label htmlFor="email" className="block text-sm font-medium mb-1">
						{t('settings.email')}
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder={t('settings.enterEmail')}
					/>
				</div>

				<div>
					<label htmlFor="language" className="block text-sm font-medium mb-1">
						{t('settings.language')}
					</label>
					<select
						id="language"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={language}
						onChange={handleLanguageChange}
					>
						<option value="en">{t('languages.en')} (EN)</option>
						<option value="fr">{t('languages.fr')} (FR)</option>
						<option value="es">{t('languages.es')} (ES)</option>
					</select>
				</div>
				<div>
					<label htmlFor='2fa' className="block text-sm font-medium mb-1">
						{t('settings.twoFactor')}
					</label>
					<input
						id='2fa'
						type="checkbox"
						checked={is2FAEnabled}
						onChange={handle2FAChange}
						className="mr-2 leading-tight"
					/>
					<span>{t('settings.enable2FA')}</span>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? t('settings.saving') : t('settings.saveChanges')}
				</button>
			</form>
		</div>
	)
}

export default Settings;