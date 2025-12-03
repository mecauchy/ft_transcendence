import { useState } from 'react'
import './styles/login.css'

function Login({onLogin}: {onLogin: (username: string) => void}) {

	//state
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');

	const[user, setUser] = useState<{username: string, password: string} | null>(null);


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
	  <p className='login_title'>ft_transcendance</p>
	  <p className='login_subtitle'>Tournois de Pong en ligne</p>
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
	  	<p>Creez ou rejoignez un tournoi pour commencer</p>
	  </div>
	</div>
  )
}

export default Login
