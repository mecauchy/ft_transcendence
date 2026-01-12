import {useState} from 'react';
import {api} from '../api/client';
import type {ApiError} from '../api/client';
import '../styles/login.css';
import {useTranslation} from 'react-i18next';

interface LoginProps {
	onLogin: (username: string) => void;
}

function Login({onLogin}: LoginProps) {
	const {t} = useTranslation();

	// default state
	const [ulogin, setLogin] = useState('');
	const [password, setPassword] = useState('');
	const [registerMode, setRegisterMode] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// registration state
	const [createUsername, setCreateUsername] = useState('');
	const [createPassword, setCreatePassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [createEmail, setCreateEmail] = useState('');
	const [birthdate, setBirthdate] = useState('');

	// validate password
	const [passwordFormat, setPasswordFormat] = useState(false);
	const [uppercasePresent, setUppercasePresent] = useState(false);
	const [lowercasePresent, setLowercasePresent] = useState(false);
	const [numberPresent, setNumberPresent] = useState(false);
	const [specialCharPresent, setSpecialCharPresent] = useState(false);
	const [badConfirmation, setBadConfirmation] = useState(false);

	// login submission
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const response = await api.login({login: ulogin, password});
			console.log('Login successful:', response.user);
			onLogin(response.user.username);
		} catch (err) {
			const apiError = err as ApiError;
			setError(apiError.message || 'Connection error');
			console.error('Login error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	// submit registration handler
	const handleRegister = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);

		if (createPassword !== confirmPassword) {
			setBadConfirmation(true);
			setError('Passwords don\'t match');
			return;
		}

		if (!passwordFormat) {
			setError('Password doesn\'t follow security rules');
			return;
		}

		setIsLoading(true);

		try {
			await api.register({
				username: createUsername,
				email: createEmail,
				password: createPassword,
				dob: birthdate,
			});
			console.log('Registration successful');

			// auto login after registration
			const loginResponse = await api.login({
				login: createEmail,
				password: createPassword,
			});
			onLogin(loginResponse.user.username);
		} catch (err) {
			const apiError = err as ApiError;
			setError(apiError.message || "Registration error");
			console.error('Registration error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	// validate pw here
	const handleCreatePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		setCreatePassword(value);
		setBadConfirmation(false);

		setUppercasePresent(/[A-Z]/.test(value));
		setLowercasePresent(/[a-z]/.test(value));
		setNumberPresent(/\d/.test(value));
		setSpecialCharPresent(/[@$!%*?&]/.test(value));

		setPasswordFormat(
			value.length >= 8 &&
				/[A-Z]/.test(value) &&
				/[a-z]/.test(value) &&
				/\d/.test(value) &&
				/[@$!%*?&]/.test(value)
		);
	};

	// OAuth handlers
	const handleGithubLogin = () => {
		window.location.href = api.getOAuthUrl('github');
	};

	const handle42Login = () => {
		window.location.href = api.getOAuthUrl('42');
	};

	return (
		<div className="login_container">
			<img src="/controler.png" alt="Logo" className="login_logo_image" />
			<p className="login_title">ft_transcendance</p>
			<p className="login_subtitle">{t('home.subtitle')}</p>

			{/* Error message */}
			{error && <div className="login_error">{error}</div>}

			{/* Login Form */}
			{!registerMode && (
				<div className="login_button_container">
					<form onSubmit={handleSubmit} className="login_form">
						<p className="username">{t('auth.login')}</p>
						<input
							type="string"
							className="username_input"
							placeholder={t('auth.enterUsernameOrEmail')}
							value={ulogin}
							onChange={(e) => setLogin(e.target.value)}
							disabled={isLoading}
							required
						/>
						<p className="password">{t('auth.password')}</p>
						<input
							type="password"
							className="password_input"
							placeholder={t('auth.enterPassword')}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={isLoading}
							required
						/>
						<br />
						<button className="login_button" type="submit" disabled={isLoading}>
							{isLoading ? t('auth.connecting') : t('auth.connect')}
						</button>
					</form>
				</div>
			)}

			{/* Registration Form */}
			{registerMode && (
				<div className="login_button_container">
					<form onSubmit={handleRegister} className="login_form">
						<p className="username">{t('auth.email')}</p>
						<input
							type="email"
							className="username_input"
							placeholder={t('auth.enterEmail')}
							value={createEmail}
							onChange={(e) => setCreateEmail(e.target.value)}
							disabled={isLoading}
							required
						/>
						<p className="username">{t('auth.username')}</p>
						<input
							type="text"
							className="username_input"
							placeholder={t('auth.chooseUsername')}
							value={createUsername}
							onChange={(e) => setCreateUsername(e.target.value)}
							disabled={isLoading}
							required
						/>
						<p className="username">{t('auth.birthdate')}</p>
						<input
							type="date"
							className="username_input"
							value={birthdate}
							onChange={(e) => setBirthdate(e.target.value)}
							disabled={isLoading}
							required
						/>
						<p className="password">{t('auth.password')}</p>
						<input
							type="password"
							className="password_input"
							placeholder={t('auth.choosePassword')}
							value={createPassword}
							onChange={handleCreatePassword}
							disabled={isLoading}
							required
						/>
						{/* Password requirements */}
						<div className="password_requirements">
							<span className={uppercasePresent ? 'valid' : ''}>{t('passwordRequirements.uppercase')}</span>
							<span className={lowercasePresent ? 'valid' : ''}>{t('passwordRequirements.lowercase')}</span>
							<span className={numberPresent ? 'valid' : ''}>{t('passwordRequirements.number')}</span>
							<span className={specialCharPresent ? 'valid' : ''}>{t('passwordRequirements.specialChar')}</span>
							<span className={createPassword.length >= 8 ? 'valid' : ''}>{t('passwordRequirements.characters')}</span>
						</div>
						<p className="password">{t('auth.confirmPassword')}</p>
						<input
							type="password"
							className="password_input"
							placeholder={t('auth.confirmPassword')}
							value={confirmPassword}
							onChange={(e) => {
								setConfirmPassword(e.target.value);
								setBadConfirmation(false);
							}}
							disabled={isLoading}
							required
						/>
						{badConfirmation && (
							<p className="error_message">{t('auth.passwordsDontMatch')}</p>
						)}
						<br />
						<button
							className="login_button"
							type="submit"
							disabled={isLoading || !passwordFormat}
						>
							{isLoading ? t('auth.registering') : t('auth.signUp')}
						</button>
					</form>
				</div>
			)}

			{/* OAuth Buttons */}
			<div className="oauth_container">
				<button className="oauth_button github" onClick={handleGithubLogin} disabled={isLoading}>
					<img src="/github_logo.png" alt="GitHub" />
					{t('auth.continueWithGithub')}
				</button>
				<button className="oauth_button forty_two" onClick={handle42Login} disabled={isLoading}>
					<img src="/42_logo.png" alt="42" />
					{t('auth.continueWith42')}
				</button>
			</div>

			{/* Toggle Register/Login */}
			<p className="toggle_mode">
				{registerMode ? (
					<>
						{t('auth.alreadyHaveAccount')}{' '}
						<span onClick={() => setRegisterMode(false)}>{t('auth.connect')}</span>
					</>
				) : (
					<>
						{t('auth.noAccount')}{' '}
						<span onClick={() => setRegisterMode(true)}>{t('auth.signUp')}</span>
					</>
				)}
			</p>
		</div>
	);
}

export default Login;
