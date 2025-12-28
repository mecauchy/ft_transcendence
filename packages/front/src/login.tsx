import {useState} from 'react'
import './styles/login.css'

function Login({onLogin}: {onLogin: (username: string) => void}) {

	//state
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [registerMode, setRegisterMode] = useState<boolean>(false);

	const[user, setUser] = useState<{username: string, password: string} | null>(null);
	const[newUser, setNewUser] = useState<{username: string, password: string, email: string, birthdate: string} | null>(null);
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

	void user;
	void newUser;
	//handlers for registration
	const handleRegister = (event: React.FormEvent) => {
		event.preventDefault();
		console.log('Registration form submitted');
		if (createUsername && createPassword && createPassword === confirmPassword && passwordFormat) {
			setNewUser({username: createUsername, password: createPassword, email: createEmail, birthdate: birthdate});
			console.log('User registered:', {createUsername, createPassword, createEmail, birthdate});
			onLogin(createUsername);
		}
		else if (createPassword !== confirmPassword) {
			setBadConfirmation(true);
			console.log('Password confirmation does not match');
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
	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		console.log('Form submitted');
		if (username && password) {
			setUser({username, password});
			console.log('User logged in:', {username, password});
			onLogin(username);
		}
	}

	const handleChangeUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}

	const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}

	const handleGithubLogin = () => {
		console.log('GitHub login clicked');
		// Implement GitHub OAuth flow here
	}

	const handle42Login = () => {
		console.log('42 login clicked');
		// Implement 42 OAuth flow here
	}

  return (
	<div className='login_container'>
		<img src='/controler.png' alt='Logo' className='login_logo_image' />
	  <p className='login_title'>ft_transcendance</p>
	  <p className='login_subtitle'>Quand parler devient une mécanique de jeu.</p>
	  {!registerMode &&
	  <div className='login_button_container'>
		<form onSubmit={handleSubmit} className='login_form'>
			<p className='username'>Nom d'utilisateur</p>
			<input
			  type="text"
			  className='username_input'
			  placeholder="Entrez votre nom d'utilisateur"
			  onChange={handleChangeUsername}
			  required
			/>
			<p className='password'>Mot de passe</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder="Entrez votre mot de passe"
			  onChange={handleChangePassword}
			  required
			/>
			<br />
			<button 
			className='login_button'
			type="submit">
				Se connecter
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
			  onChange={handleCreateEmail}
			  required
			/>
			<p className='username'>Choisissez un nom d'utilisateur</p>
			<input
			  type="text"
			  className='username_input'
			  placeholder="Entrez votre nom d'utilisateur"
			  onChange={handleCreateUsername}
			  required
			/>
			<p className='birthdate'>Date de naissance</p>
			<input 
			  type="date"
			  id="birthdate"
			  className='birthdate_input'
			  value={birthdate}
			  onChange={handleBirthdateChange}
			  required
			/>
			<p className='password'>Choisissez un mot de passe</p>
			<input
			  type="password"
			  className='password_input'
			  placeholder="Entrez votre mot de passe"
			  onChange={handleCreatePassword}
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
			  onChange={handleConfirmPassword}
			  required
			/>
			<br />
			<button 
			className='login_button'
			type="submit">
				S'inscrire
			</button>
		</form>
	  </div>
	 }
	  <div className='login_api'>
		<p>Se connecter avec :</p>
		<div className='login_api_buttons'>
			<button className='login_api_button_github'
			onClick={handleGithubLogin}>
				<img src='/github_logo.png' alt='GitHub Logo' className='login_api_button_github_logo' />
			</button>
			<button className='login_api_button_42'
			onClick={handle42Login}>
				<img src='/42_logo.png' alt='42 Logo' className='login_api_button_42_logo' />
			</button>
		</div>
	  </div>
	  <div className='login_divider'>
			{!registerMode &&
			<button className='login_register_button'
			onClick={() => setRegisterMode(true)}>
				Pas encore de compte ? Créez-en un ici
			</button>}
			{registerMode &&
			<button className='login_register_button'
			onClick={() => setRegisterMode(false)}>
				Déjà un compte ? Connectez-vous ici
			</button>}
			<p>Lancez une session et faites vos premiers choix.</p>
	  </div>
	</div>
  )
}

export default Login
