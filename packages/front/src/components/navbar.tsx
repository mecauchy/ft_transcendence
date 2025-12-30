import '../styles/navbar.css'
import {useTranslation} from 'react-i18next'

function Navbar({setPage, username}: {setPage: (page: string) => void, username: string | null}) {
	  const {t} = useTranslation();
	  
	  return (
		<nav className="navbar">
  			<div className="flex">
				<img src="/controler.png" alt="Logo" className="logo_image" />
				<p className="mt-5 text-white">
					ft_transcendance
				</p>
			</div>

  			<div className="nav_left">
  			  <button className="nav_button tournament_box" onClick={() => setPage("game")}>
  			    {t('nav.play')}
  			  </button>

  			</div>

  			<div className="nav_right">
  			  <button className="nav_button" onClick={() => setPage("network")}>{t('nav.network')}</button>
  			  <button className="nav_button" onClick={() => setPage("settings")}>{t('nav.settings')}</button>
  			  <button className="nav_button logout" onClick={() => setPage("logout")}>
  			    {t('nav.logout')} ({username})
  			  </button>
  			</div>
		</nav>

  )
}

export default Navbar;