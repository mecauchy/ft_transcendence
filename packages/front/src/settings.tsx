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
	const [show2FAModal, setShow2FAModal] = useState(false);
	const [qrCode, setQrCode] = useState<string | null>(null);
	const [twoFACode, setTwoFACode] = useState('');
	const [is2FALoading, setIs2FALoading] = useState(false);

	// Sync language state with current i18n language when it changes externally
	useEffect(() => {
		const currentLang = i18n.language as 'en' | 'fr' | 'es';
		if (['en', 'fr', 'es'].includes(currentLang)) {
			setLanguage(currentLang);
		}
	}, [i18n.language]);

	const handle2FAToggle = async () => {
		if (is2FAEnabled) {
			// disable 2FA
			try {
				await api.disable2FA();
				setIs2FAEnabled(false);
				setMessage({type: 'success', text: t('settings.2faDisabled')});
			} catch (error: unknown) {
				const err = error as {message?: string};
				setMessage({type: 'error', text: err.message || t('settings.2faDisableFailed')});
			}
		} else {
			// start 2FA setup
			setIs2FALoading(true);
			try {
				const response = await api.setup2FA();
				setQrCode(response.qrCode);
				setShow2FAModal(true);
			} catch (error: unknown) {
				const err = error as {message?: string};
				setMessage({type: 'error', text: err.message || t('settings.2faSetupFailed')});
			} finally {
				setIs2FALoading(false);
			}
		}
	};

	const verify2FACode = async () => {
		if (!twoFACode || twoFACode.length !== 6) {
			setMessage({type: 'error', text: t('settings.invalid2FACode')});
			return;
		}
		setIs2FALoading(true);
		try {
			const response = await api.verify2FA(twoFACode);
			if (response.verified) {
				setIs2FAEnabled(true);
				setShow2FAModal(false);
				setQrCode(null);
				setTwoFACode('');
				setMessage({type: 'success', text: t('settings.2faEnabled')});
			}
		} catch (error: unknown) {
			const err = error as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.2faVerifyFailed')});
		} finally {
			setIs2FALoading(false);
		}
	};

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newLang = e.target.value as 'en' | 'fr' | 'es';
		setLanguage(newLang);
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
					<label className="block text-sm font-medium mb-1">
						{t('settings.twoFactor')}
					</label>
					<button
						type="button"
						onClick={handle2FAToggle}
						disabled={is2FALoading}
						className={`px-4 py-2 rounded-md ${is2FAEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white disabled:opacity-50`}
					>
						{is2FALoading ? t('common.loading') : (is2FAEnabled ? t('settings.disable2FA') : t('settings.enable2FA'))}
					</button>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? t('settings.saving') : t('settings.saveChanges')}
				</button>
			</form>

			{/* 2FA setup modal */}
			{show2FAModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
						<h2 className="text-xl font-bold mb-4 text-gray-800">{t('settings.setup2FA')}</h2>
						<p className="text-gray-600 mb-4">{t('settings.scan2FAQRCode')}</p>
						{qrCode && (
							<div className="flex justify-center mb-4">
								<img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
							</div>
						)}
						<input
							type="text"
							value={twoFACode}
							onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
							placeholder={t('settings.enter2FACode')}
							className="w-full px-3 py-2 border rounded-md mb-4 text-gray-800"
							maxLength={6}
						/>
						<div className="flex gap-2">
							<button
								onClick={() => {setShow2FAModal(false); setQrCode(null); setTwoFACode('');}}
								className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={verify2FACode}
								disabled={is2FALoading || twoFACode.length !== 6}
								className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
							>
								{is2FALoading ? t('common.loading') : t('common.confirm')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default Settings;