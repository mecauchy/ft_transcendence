import {useState, useEffect, useRef} from 'react'
import {useAuth} from './contexts/AuthContext'
import { api } from './api/client';
import { useTranslation } from 'react-i18next';

function Settings() {
	const { user, refreshUser, logout } = useAuth();
	const { t, i18n } = useTranslation();
	const [username, setUsername] = useState(user?.username || '');
	const [email, setEmail] = useState(user?.email || '');
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
	const [language, setLanguage] = useState<'en' | 'fr' | 'es'>((i18n.language as 'en' | 'fr' | 'es') || 'en');

	// avatar upload
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);

	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// file type validation
		if (!file.type.startsWith('image/')) {
			setMessage({type: 'error', text: t('settings.avatar.invalidType')});
			return;
		}

		// set maxsize
		if (file.size > 5 * 1024 * 1024) {
			setMessage({type: 'error', text: t('settings.avatar.tooLarge')});
			return;
		}

		// show preview
		const reader = new FileReader();
		reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
		reader.readAsDataURL(file);

		// upload
		setAvatarUploading(true);
		setMessage(null);

		try {
			const res = await api.uploadAvatar(file);
			setAvatarPreview(res.url);
			setMessage({type: 'success', text: t('settings.avatar.uploadSuccess')});
			await refreshUser();
		} catch (error: unknown) {
			const err = error as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.avatar.uploadFailed')});
			// on error revert
			setAvatarPreview(user?.avatarUrl || null);
		} finally {
			setAvatarUploading(false);
		}
	};
	
	// 2FA
	const [is2FAEnabled, setIs2FAEnabled] = useState(false);
	const [show2FAModal, setShow2FAModal] = useState(false);
	const [qrCode, setQrCode] = useState<string | null>(null);
	const [twoFACode, setTwoFACode] = useState('');
	const [is2FALoading, setIs2FALoading] = useState(false);

	// load 2FA status on mount
	useEffect(() => {
		const load2FAStatus = async () => {
			try {
				const profile = await api.getProfile();
				setIs2FAEnabled(profile.twofaEnabled || false);
			} catch {
				// ignore error, default to false
			}
		};
		load2FAStatus();
	}, []);

	// GDPR / export / import
	const [gdprBusy, setGdprBusy] = useState(false);
	const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | 'xml' | null>(null);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState('');
	const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);

	const [importFile, setImportFile] = useState<File | null>(null);
	const [importBusy, setImportBusy] = useState(false);
	const [importProgress, setImportProgress] = useState(0);
	const [importSummary, setImportSummary] = useState<{
		processed?: number;
		updated?: number;
		skipped?: number;
		errors?: Array<{row?: number; message: string} | string>;
	} | null> (null);

	const downloadFromEndpoint = async (endpoint: string, filename: string, format: 'json' | 'csv' | 'xml') => {
		setGdprBusy(true);
		setExportingFormat(format);
		setMessage(null);

		try {
			const token = localStorage.getItem('accessToken');
			const headers: HeadersInit = {
				'Content-Type': 'application/json',
			};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const res = await fetch(`api/users${endpoint}`, {
				method: 'GET',
				headers,
				credentials: 'include',
			});

			if (!res.ok) {
				const err = await res.json().catch(() => null);
				throw new Error(err?.message || `HTTP ${res.status}`);
			}

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);

			setMessage({type: 'success', text: t('settings.gdpr.exportSuccess')});
		} catch (e: unknown) {
			const err = e as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.gdpr.exportFailed')});
		} finally {
			setGdprBusy(false);
			setExportingFormat(null);
		}
	};

	const handleDeleteAccount = async () => {
		if (!deleteAcknowledge || deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
			setMessage({type: 'error', text: t('settings.gdpr.deleteConfirmInvalid')});
			return ;
		}

		setGdprBusy(true);
		setMessage(null);

		try {
			const token = localStorage.getItem('accessToken');
			const headers: HeadersInit = {
				'Content-Type': 'application/json',
			};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const res = await fetch('/api/users/gdpr/delete', {
				method: 'DELETE',
				headers,
				credentials: 'include',
			});

			if (!res.ok) {
				const err = await res.json().catch(() => null);
				throw new Error(err?.message || `HTTP ${res.status}`);
			}

			// show success message
			setShowDeleteModal(false);
			setMessage({type: 'success', text: t('settings.gdpr.deleteSuccess')});

			// logout and redirect
			setTimeout(async () => {
				await logout();
				window.location.href = '/';
			}, 1500);
		} catch (e: unknown) {
			const err = e as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.gdpr.deleteFailed')});
		} finally {
			setGdprBusy(false);
			setDeleteConfirmText('');
			setDeleteAcknowledge(false);
		}
	};

	const handleImport = async () => {
		if (!importFile) {
			setMessage({type: 'error', text: t('settings.import.noFile')});
			return ;
		}

		setImportBusy(true);
		setImportSummary(null);
		setImportProgress(0);
		setMessage(null);

		// progress bar
		const progressInterval = setInterval(() => {
			setImportProgress((prev) => Math.min(prev + 10, 90));
		}, 200);

		try {
			const form = new FormData();
			form.append('file', importFile);

			const token = localStorage.getItem('accessToken');
			const headers: HeadersInit = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const res = await fetch('/api/users/import', {
				method: 'POST',
				headers,
				body: form,
				credentials: 'include',
			});

			const data = await res.json().catch(() => null);

			if (!res.ok) {
				throw new Error(data?.message || `HTTP ${res.status}`);
			}

			clearInterval(progressInterval);
			setImportProgress(100);

			setImportSummary({
				processed: data?.processed,
				updated: data?.updated,
				skipped: data?.skipped,
				errors: data?.errors || [],
			});

			setMessage({type: 'success', text: t('settings.import.success')});

		} catch (e: unknown) {
			clearInterval(progressInterval);
			setImportProgress(0);
			const err = e as {message?: string};
			setMessage({type: 'error', text: err.message || t('settings.import.failed')});
		} finally {
			clearInterval(progressInterval);
			setImportBusy(false);
			setTimeout(() => setImportProgress(0), 2000);
		}
	};

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
				// refresh userdata
				await refreshUser();
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
				{/* Avatar Upload Section */}
				<div className="flex flex-col items-center mb-4">
					<div className="relative group">
						{avatarPreview ? (
							<img
								src={avatarPreview}
								alt="Avatar"
								className="w-24 h-24 rounded-full object-cover border-2 border-white/20"
							/>
						) : (
							<div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-white/20">
								{user?.username?.[0]?.toUpperCase() || '?'}
							</div>
						)}
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={avatarUploading}
							className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer disabled:cursor-wait"
						>
							{avatarUploading ? (
								<span className="animate-spin text-2xl">⏳</span>
							) : (
								<span className="text-white text-sm font-medium">{t('settings.avatar.change')}</span>
							)}
						</button>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handleAvatarChange}
						className="hidden"
					/>
					<p className="text-xs text-gray-400 mt-2">{t('settings.avatar.hint')}</p>
				</div>

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

			{/* GDPR / Export / Import */}
			<div className="mt-8 space-y-4">
			<div className="p-4 rounded-md bg-white/5 border border-white/10">
				<h2 className="text-lg font-semibold mb-3">{t('settings.gdpr.title')}</h2>

				<div className="flex flex-col gap-2">
				<button
					type="button"
					disabled={gdprBusy}
					onClick={() => downloadFromEndpoint('/gdpr/export', 'user-export.json', 'json')}
					className="w-full px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
				>
					{exportingFormat === 'json' ? (
						<>
							<span className="animate-spin">⏳</span>
							<span>{t('common.loading')}</span>
						</>
					) : (
						<>
							<span>{t('settings.gdpr.exportJson')}</span>
						</>
					)}
				</button>

				<button
					type="button"
					disabled={gdprBusy}
					onClick={() => downloadFromEndpoint('/gdpr/export/csv', 'sessions-export.csv', 'csv')}
					className="w-full px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
				>
					{exportingFormat === 'csv' ? (
						<>
							<span className="animate-spin">⏳</span>
							<span>{t('common.loading')}</span>
						</>
					) : (
						<>
							<span>{t('settings.gdpr.exportCsv')}</span>
						</>
					)}
				</button>

				{/* Only keep this if you added the backend XML route */}
				<button
					type="button"
					disabled={gdprBusy}
					onClick={() => downloadFromEndpoint('/gdpr/export/xml', 'user-export.xml', 'xml')}
					className="w-full px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
				>
					{exportingFormat === 'xml' ? (
						<>
							<span className="animate-spin">⏳</span>
							<span>{t('common.loading')}</span>
						</>
					) : (
						<>
							<span>{t('settings.gdpr.exportXml')}</span>
						</>
					)}
				</button>

				<button
					type="button"
					disabled={gdprBusy}
					onClick={() => setShowDeleteModal(true)}
					className="w-full px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
				>
					<span>{t('settings.gdpr.deleteAccount')}</span>
				</button>
				</div>
			</div>

			<div className="p-4 rounded-md bg-white/5 border border-white/10">
				<h2 className="text-lg font-semibold mb-3">{t('settings.import.title')}</h2>

				<input
				type="file"
				accept=".json,.csv,.xml"
				onChange={(e) => {
					setImportFile(e.target.files?.[0] || null);
					setImportSummary(null);
				}}
				disabled={importBusy}
				className="block w-full text-sm mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
				/>

				{importFile && (
					<div className="mb-3 text-sm text-gray-300">
						Selected: <span className="font-semibold">{importFile.name}</span> ({(importFile.size / 1024).toFixed(1)} KB)
					</div>
				)}

				{importProgress > 0 && importProgress < 100 && (
					<div className="mb-3">
						<div className="flex justify-between text-xs mb-1">
							<span>Importing...</span>
							<span>{importProgress}%</span>
						</div>
						<div className="w-full bg-gray-700 rounded-full h-2">
							<div 
								className="bg-blue-500 h-2 rounded-full transition-all duration-300"
								style={{width: `${importProgress}%`}}
							/>
						</div>
					</div>
				)}

				<button
				type="button"
				disabled={importBusy || !importFile}
				onClick={handleImport}
				className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
				>
				{importBusy ? (
					<>
						<span className="animate-spin">⏳</span>
						<span>{t('common.loading')}</span>
					</>
				) : (
					<>
						<span>{t('settings.import.upload')}</span>
					</>
				)}
				</button>

				{importSummary && (
				<div className="mt-4 p-3 rounded-md bg-white/5 border border-green-500/30">
					<div className="text-sm space-y-1">
						<div className="flex justify-between">
							<span className="text-gray-300">{t('settings.import.processed')}:</span>
							<span className="font-semibold text-white">{importSummary.processed ?? 0}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-300">{t('settings.import.updated')}:</span>
							<span className="font-semibold text-green-400">{importSummary.updated ?? 0}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-300">{t('settings.import.skipped')}:</span>
							<span className="font-semibold text-yellow-400">{importSummary.skipped ?? 0}</span>
						</div>
					</div>

					{!!(importSummary.errors && importSummary.errors.length) && (
					<div className="mt-3 pt-3 border-t border-red-500/30">
						<div className="font-semibold text-red-400 mb-2">{t('settings.import.errors')}:</div>
						<ul className="list-none space-y-1 text-xs">
						{importSummary.errors.slice(0, 10).map((er, idx) => (
							<li key={idx} className="text-red-300 pl-4 relative">
								<span className="absolute left-0"></span>
								{typeof er === 'string' ? er : (er.row ? `Row ${er.row}: ${er.message}` : er.message)}
							</li>
						))}
						{importSummary.errors.length > 10 && (
							<li className="text-gray-400 italic">
								...and {importSummary.errors.length - 10} more errors
							</li>
						)}
						</ul>
					</div>
					)}
				</div>
				)}
			</div>
			</div>

			{/* Delete account modal */}
			{showDeleteModal && (
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
				<div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
				<h2 className="text-xl font-bold mb-2 text-gray-800">
					{t('settings.gdpr.deleteTitle')}
				</h2>

				<p className="text-gray-700 mb-4">
					{t('settings.gdpr.deleteWarning')}
				</p>

				<label className="flex items-center gap-2 text-gray-800 mb-3">
					<input
					type="checkbox"
					checked={deleteAcknowledge}
					onChange={(e) => setDeleteAcknowledge(e.target.checked)}
					/>
					<span>{t('settings.gdpr.deleteAcknowledge')}</span>
				</label>

				<label className="block text-sm font-medium text-gray-800 mb-1">
					{t('settings.gdpr.typeDelete')}
				</label>
				<input
					type="text"
					value={deleteConfirmText}
					onChange={(e) => setDeleteConfirmText(e.target.value)}
					className="w-full px-3 py-2 border rounded-md mb-4 text-gray-800"
					placeholder="DELETE"
				/>

				<div className="flex gap-2">
					<button
					type="button"
					onClick={() => {
						setShowDeleteModal(false);
						setDeleteConfirmText('');
						setDeleteAcknowledge(false);
					}}
					className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
					>
					{t('common.cancel')}
					</button>

					<button
					type="button"
					disabled={gdprBusy || !deleteAcknowledge || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
					onClick={handleDeleteAccount}
					className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
					>
					{gdprBusy ? t('common.loading') : t('settings.gdpr.confirmDelete')}
					</button>
				</div>
				</div>
			</div>
			)}


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