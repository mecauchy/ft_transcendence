import './styles/navbar.css'

function Navbar({setPage, username}: {setPage: (page: string) => void, username: string | null}) {
	  return (
		<nav className="navbar">
  			<div className="nav_logo">ft_transcendance</div>

  			<div className="nav_left">
  			  <button className="nav_button tournament_box" onClick={() => setPage("tournament")}>
  			    Tournament
  			  </button>
  			  <button className="nav_button nav_button_play" onClick={() => setPage("game")}>
  			    Play
  			  </button>
  			</div>

  			<div className="nav_right">
  			  <button className="nav_button" onClick={() => setPage("profile")}>{username}<div className='hat'>^</div></button>
  			  <button className="nav_button" onClick={() => setPage("settings")}>Settings</button>
  			  <button className="nav_button logout" onClick={() => setPage("logout")}>
  			    Logout ({username})
  			  </button>
  			</div>
		</nav>

  )
}

export default Navbar;