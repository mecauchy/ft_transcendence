import '../styles/navbar.css'

function Navbar({setPage, username}: {setPage: (page: string) => void, username: string | null}) {
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
  			    Play
  			  </button>

  			</div>

  			<div className="nav_right">
  			  <button className="nav_button" onClick={() => setPage("network")}>Network</button>
  			  <button className="nav_button" onClick={() => setPage("settings")}>Settings</button>
  			  <button className="nav_button logout" onClick={() => setPage("logout")}>
  			    Logout ({username})
  			  </button>
  			</div>
		</nav>

  )
}

export default Navbar;