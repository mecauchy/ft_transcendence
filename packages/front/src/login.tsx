import {useState} from 'react'
import './styles/login.css'
import {useAuth} from './contexts/AuthContext'
import {useTranslation} from 'react-i18next'

function Login({onLogin, onNavigateToLegal}: {onLogin: (username: string) => void, onNavigateToLegal?: (page: string) => void}) {
	const {login, verify2FALogin, register, loginWithOAuth} = useAuth();
	const {t} = useTranslation();

	//state
	const [ulogin, setLogin] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [registerMode, setRegisterMode] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [errorMessage, setErrorMessage] = useState<string>('');
	
	// 2FA state
	const [show2FAModal, setShow2FAModal] = useState<boolean>(false);
	const [twoFACode, setTwoFACode] = useState<string>('');

	const [createUsername, setCreateUsername] = useState<string>('');
	const [createPassword, setCreatePassword] = useState<string>('');
	const [confirmPassword, setConfirmPassword] = useState<string>('');
	const [badConfirmation, setBadConfirmation] = useState<boolean>(false);
	const [createEmail, setCreateEmail] = useState<string>('');
	const [passwordFormat, setPasswordFormat] = useState<boolean>(false);
	const [uppercasePresent, setUppercasePresent] = useState<boolean>(false);
	const [lowercasePresent, setLowercasePresent] = useState<boolean>(false);
	const [numberPresent, setNumberPresent] = useState<boolean>(false);
	const [specialCharPresent, setSpecialCharPresent] = useState<boolean>(false);
	const [birthdate, setBirthdate] = useState<string>('');
	//handlers for registration
	const handleRegister = async (event: React.FormEvent) => {
		event.preventDefault();
		setErrorMessage('');

		if (createPassword !== confirmPassword) {
			setBadConfirmation(true);
			return;
		}

		if (!passwordFormat) {
			setErrorMessage(t('auth.passwordRequirements'));
			return;
		}

		setIsLoading(true);
		try {
			await register(createUsername, createEmail, createPassword, birthdate);
			onLogin(createUsername);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : t('auth.registerFailed'));
		} finally {
			setIsLoading(false);
		}
	}

	const handleCreateUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCreateUsername(event.target.value);
	}
	//password need 8 characters, one uppercase, one lowercase, one number and one special character
	const handleCreatePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCreatePassword(event.target.value);
		setBadConfirmation(false);
		setUppercasePresent(/[A-Z]/.test(event.target.value));
		setLowercasePresent(/[a-z]/.test(event.target.value));
		setNumberPresent(/\d/.test(event.target.value));
		setSpecialCharPresent(/[@$!%*?&]/.test(event.target.value));
		if (event.target.value.length >= 8 &&
			/[A-Z]/.test(event.target.value) &&
			/[a-z]/.test(event.target.value) &&
			/\d/.test(event.target.value) &&
			/[@$!%*?&]/.test(event.target.value)) {
				setPasswordFormat(true);
		} else {
			setPasswordFormat(false);
		}
	}
	const handleConfirmPassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		setConfirmPassword(event.target.value);
		setBadConfirmation(false);
	}

	const handleCreateEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCreateEmail(event.target.value);
	}

	const handleBirthdateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setBirthdate(event.target.value);
	}

	//handlers
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setErrorMessage('');

		if (!ulogin || !password) {
			setErrorMessage(t('auth.fillAllFields'));
			return;
		}

		setIsLoading(true);
		try {
			await login(ulogin, password);
			// onLogin is handled by AuthContext - the user state change will trigger re-render
		} catch (error) {
			if (error instanceof Error && error.message === '2FA_REQUIRED') {
				// show 2FA modal
				setShow2FAModal(true);
				setErrorMessage('');
			} else {
				setErrorMessage(error instanceof Error ? error.message : t('auth.loginFailed'));
			}
		} finally {
			setIsLoading(false);
		}
	}

	const handle2FASubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setErrorMessage('');

		if (!twoFACode || twoFACode.length !== 6) {
			setErrorMessage(t('auth.invalid2FACode'));
			return;
		}

		setIsLoading(true);
		try {
			await verify2FALogin(twoFACode);
			// success
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : t('auth.2faVerificationFailed'));
		} finally {
			setIsLoading(false);
		}
	}

	const handleChangeLogin = (event: React.ChangeEvent<HTMLInputElement>) => {
		setLogin(event.target.value);
		setErrorMessage('');
	}

	const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
		setErrorMessage('');
	}

	const handle42Login = () => {
		loginWithOAuth('42');
	}

  return (
	<div className='login_container'>
		<img src='/controler.png' alt='Logo' className='login_logo_image' />
	  <p className='login_title'>ft_transcendance</p>
	  <p className='login_subtitle'>{t('home.subtitle')}</p>
	  
	  {errorMessage && (
		<div className='login_error_message'>
			{errorMessage}
		</div>
	  )}
	  
	  {!registerMode &&
	  <div className='login_button_container'>
		<form onSubmit={handleSubmit} className='login_form'>
			<p className='username'>{t('auth.login')}</p>
			<input
			  type="string"
			  className='username_input'
			  placeholder={t('auth.enterUsernameOrEmail')}
			  value={ulogin}
			  onChange={handleChangeLogin}
			  disabled={isLoading}
			  required
			/>
			<p className='password'>{t('auth.password')}</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder={t('auth.enterPassword')}
			  value={password}
			  onChange={handleChangePassword}
			  disabled={isLoading}
			  required
			/>
			<br />
			<button 
			className='login_button'
			type="submit"
			disabled={isLoading}>
				{isLoading ? t('auth.connecting') : t('auth.connect')}
			</button>
		</form>
	  </div>
	 }
	  {registerMode &&
	  <div className='login_button_container'>
		<form onSubmit={handleRegister} className='login_form'>
			<p className='username'>{t('auth.enterEmail')}</p>
			<input
			  type="email"
			  className='username_input'
			  placeholder={t('auth.enterEmail')}
			  value={createEmail}
			  onChange={handleCreateEmail}
			  disabled={isLoading}
			  required
			/>
			<p className='username'>{t('auth.chooseUsername')}</p>
			<input
			  type="text"
			  className='username_input'
			  placeholder={t('auth.enterUsername')}
			  value={createUsername}
			  onChange={handleCreateUsername}
			  disabled={isLoading}
			  required
			/>
			<p className='birthdate'>{t('auth.birthdate')}</p>
			<input 
			  type="date"
			  id="birthdate"
			  className='birthdate_input'
			  value={birthdate}
			  onChange={handleBirthdateChange}
			  disabled={isLoading}
			  required
			/>
			<p className='password'>{t('auth.choosePassword')}</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder={t('auth.enterPassword')}
			  value={createPassword}
			  onChange={handleCreatePassword}
			  disabled={isLoading}
			  required
			/>
			<div className={`password_requirements_wrapper ${
				createPassword.length > 0 && !passwordFormat ? "open" : ""
			}`}>
				<div className="password_requirements">
					<p className={createPassword.length >= 8 ? 'requirement_met' : 'requirement_not_met'}>
						{createPassword.length >= 8 ? '✔' : '✘'} {t('passwordRequirements.minChars')}
					</p>
					<p className={uppercasePresent ? 'requirement_met' : 'requirement_not_met'}>
						{uppercasePresent ? '✔' : '✘'} {t('passwordRequirements.uppercase')}
					</p>
					<p className={lowercasePresent ? 'requirement_met' : 'requirement_not_met'}>
						{lowercasePresent ? '✔' : '✘'} {t('passwordRequirements.lowercase')}
					</p>
					<p className={numberPresent ? 'requirement_met' : 'requirement_not_met'}>
						{numberPresent ? '✔' : '✘'} {t('passwordRequirements.number')}
					</p>
					<p className={specialCharPresent ? 'requirement_met' : 'requirement_not_met'}>
						{specialCharPresent ? '✔' : '✘'} {t('passwordRequirements.specialChar')}
					</p>
				</div>
			</div>
			<br />
			{badConfirmation &&
			<p className='password_confirmation_error'>{t('auth.passwordsDontMatch')}</p>
			}
			<input
			  type="password"
			  readOnly={passwordFormat ? false : true}
			  className={badConfirmation ? 'password_input_error' : 'password_input'}
			  placeholder={t('auth.confirmPassword')}
			  value={confirmPassword}
			  onChange={handleConfirmPassword}
			  disabled={isLoading}
			  required
			/>
			<br />
			<button 
			className='login_button'
			type="submit"
			disabled={isLoading}>
				{isLoading ? t('auth.registering') : t('auth.signUp')}
			</button>
		</form>
	  </div>
	 }
	  <div className='login_api'>
		<p>{t('auth.loginWith')}</p>
		<div className='login_api_buttons'>
			<button className='login_api_button_42'
			onClick={handle42Login}
			disabled={isLoading}
			type="button">
				<img src='/42_logo.png' alt='42 Logo' className='login_api_button_42_logo' />
			</button>
		</div>
	  </div>
	  <div className='login_divider'>
			{!registerMode &&
			<button className='login_register_button'
			onClick={() => setRegisterMode(true)}
			disabled={isLoading}
			type="button">
				{t('auth.createAccountHere')}
			</button>}
			{registerMode &&
			<button className='login_register_button'
			onClick={() => setRegisterMode(false)}
			disabled={isLoading}
			type="button">
				{t('auth.loginHere')}
			</button>}
			<p>{t('auth.startSession')}</p>
	  </div>
	  
	  {/* 2FA Verification Modal */}
	  {show2FAModal && (
		<div className="modal-overlay" onClick={() => setShow2FAModal(false)}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<h2 className="modal-title">{t('auth.enter2FACode')}</h2>
				<form onSubmit={handle2FASubmit}>
					<input
						type="text"
						className="modal-input"
						placeholder={t('auth.2faCodePlaceholder')}
						value={twoFACode}
						onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
						maxLength={6}
						autoFocus
						disabled={isLoading}
					/>
					{errorMessage && <p className="error-message">{errorMessage}</p>}
					<div className="modal-buttons">
						<button
							type="button"
							className="modal-button-cancel"
							onClick={() => {
								setShow2FAModal(false);
								setTwoFACode('');
								setErrorMessage('');
							}}
							disabled={isLoading}
						>
							{t('common.cancel')}
						</button>
						<button
							type="submit"
							className="modal-button-confirm"
							disabled={isLoading || twoFACode.length !== 6}
						>
							{isLoading ? t('auth.verifying') : t('auth.verify')}
						</button>
					</div>
				</form>
			</div>
		</div>
	  )}
	  
	  {/* Legal links */}
	  <div className="login-footer">
		<a 
			href="/privacy" 
			onClick={(e) => { e.preventDefault(); onNavigateToLegal?.('privacy'); }}
			className="legal-link"
		>
			{t('legal.privacyPolicyLink', 'Privacy Policy')}
		</a>
		<span className="legal-separator">•</span>
		<a 
			href="/terms" 
			onClick={(e) => { e.preventDefault(); onNavigateToLegal?.('terms'); }}
			className="legal-link"
		>
			{t('legal.termsOfServiceLink', 'Terms of Service')}
		</a>
	  </div>
	</div>
  )
}

export default Login
