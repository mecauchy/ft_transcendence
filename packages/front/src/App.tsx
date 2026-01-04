import { useState } from 'react'
import Login from './login.tsx'
import Home from './home.tsx'
import './styles/index.css'


function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");

  const handleLogin = (user: string) => {
    setIsLogged(true);
    setUsername(user);
  }

  return (
    <>
      {!isLogged ? <Login onLogin={handleLogin} /> : <Home username={username} onLogout={() => setIsLogged(false)} />}
    </>
    )
  }

export default App
