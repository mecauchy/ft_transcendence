import {useState} from 'react'
import './styles/login.css'
import {useAuth} from './contexts/AuthContext'

function Login({onLogin}: {onLogin: (username: string) => void}) {
	const {login, register, loginWithOAuth} = useAuth();

	//state
	const [ulogin, setLogin] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [registerMode, setRegisterMode] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [errorMessage, setErrorMessage] = useState<string>('');

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
			setErrorMessage('Le mot de passe ne respecte pas les exigences');
			return;
		}

		setIsLoading(true);
		try {
			await register(createUsername, createEmail, createPassword, birthdate);
			onLogin(createUsername);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Échec de l\'inscription');
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
			setErrorMessage('Veuillez remplir tous les champs');
			return;
		}

		setIsLoading(true);
		try {
			await login(ulogin, password);
			// onLogin is handled by AuthContext - the user state change will trigger re-render
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Échec de la connexion');
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

	const handleGithubLogin = () => {
		loginWithOAuth('github');
	}

	const handle42Login = () => {
		loginWithOAuth('42');
	}

  return (
	<div className='login_container'>
		<img src='/controler.png' alt='Logo' className='login_logo_image' />
	  <p className='login_title'>ft_transcendance</p>
	  <p className='login_subtitle'>Quand parler devient une mécanique de jeu.</p>
	  
	  {errorMessage && (
		<div className='login_error_message'>
			{errorMessage}
		</div>
	  )}
	  
	  {!registerMode &&
	  <div className='login_button_container'>
		<form onSubmit={handleSubmit} className='login_form'>
			<p className='username'>Login</p>
			<input
			  type="string"
			  className='username_input'
			  placeholder="Entrez votre nom d'utilisateur ou votre adresse email"
			  value={ulogin}
			  onChange={handleChangeLogin}
			  disabled={isLoading}
			  required
			/>
			<p className='password'>Mot de passe</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder="Entrez votre mot de passe"
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
				{isLoading ? 'Connexion...' : 'Se connecter'}
			</button>
		</form>
	  </div>
	 }
	  {registerMode &&
	  <div className='login_button_container'>
		<form onSubmit={handleRegister} className='login_form'>
			<p className='username'>Entrez votre adresse email</p>
			<input
			  type="email"
			  className='username_input'
			  placeholder="Entrez votre adresse email"
			  value={createEmail}
			  onChange={handleCreateEmail}
			  disabled={isLoading}
			  required
			/>
			<p className='username'>Choisissez un nom d'utilisateur</p>
			<input
			  type="text"
			  className='username_input'
			  placeholder="Entrez votre nom d'utilisateur"
			  value={createUsername}
			  onChange={handleCreateUsername}
			  disabled={isLoading}
			  required
			/>
			<p className='birthdate'>Date de naissance</p>
			<input 
			  type="date"
			  id="birthdate"
			  className='birthdate_input'
			  value={birthdate}
			  onChange={handleBirthdateChange}
			  disabled={isLoading}
			  required
			/>
			<p className='password'>Choisissez un mot de passe</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder="Entrez votre mot de passe"
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
						{createPassword.length >= 8 ? '✔' : '✘'} Au moins 8 caractères
					</p>
					<p className={uppercasePresent ? 'requirement_met' : 'requirement_not_met'}>
						{uppercasePresent ? '✔' : '✘'} Une lettre majuscule
					</p>
					<p className={lowercasePresent ? 'requirement_met' : 'requirement_not_met'}>
						{lowercasePresent ? '✔' : '✘'} Une lettre minuscule
					</p>
					<p className={numberPresent ? 'requirement_met' : 'requirement_not_met'}>
						{numberPresent ? '✔' : '✘'} Un chiffre
					</p>
					<p className={specialCharPresent ? 'requirement_met' : 'requirement_not_met'}>
						{specialCharPresent ? '✔' : '✘'} Un caractère spécial (@$!%*?&)
					</p>
				</div>
			</div>
			<br />
			{badConfirmation &&
			<p className='password_confirmation_error'>Les mots de passe ne correspondent pas</p>
			}
			<input
			  type="password"
			  readOnly={passwordFormat ? false : true}
			  className={badConfirmation ? 'password_input_error' : 'password_input'}
			  placeholder="Confirmez votre mot de passe"
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
				{isLoading ? 'Inscription...' : 'S\'inscrire'}
			</button>
		</form>
	  </div>
	 }
	  <div className='login_api'>
		<p>Se connecter avec :</p>
		<div className='login_api_buttons'>
			<button className='login_api_button_github'
			onClick={handleGithubLogin}
			disabled={isLoading}
			type="button">
				<img src='/github_logo.png' alt='GitHub Logo' className='login_api_button_github_logo' />
			</button>
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
				Pas encore de compte ? Créez-en un ici
			</button>}
			{registerMode &&
			<button className='login_register_button'
			onClick={() => setRegisterMode(false)}
			disabled={isLoading}
			type="button">
				Déjà un compte ? Connectez-vous ici
			</button>}
			<p>Lancez une session et faites vos premiers choix.</p>
	  </div>
	</div>
  )
}

export default Login
