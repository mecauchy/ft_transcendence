import { useState, useEffect } from "react";
import "./styles/tournament.css";
import Pong from "./pong";

type Match = [string, string];

function Tournament() {
  // state
  const [onCreate, setOnCreate] = useState<boolean>(false);
  const [tournamentName, setTournamentName] = useState<string>("");
  const [player, setPlayer] = useState<string>("");
  const [players, setPlayers] = useState<string[]>([]);
  const [tournaments, setTournaments] = useState<
    { id: number; name: string; players: string[]; done: boolean; winner: string }[]
  >([]);
  const [nextTournamentId, setNextTournamentId] = useState<number>(1);

  const [gameInProgress, setGameInProgress] = useState<boolean>(false);
  const [tournamentInProgress, setTournamentInProgress] =
    useState<boolean>(false);

  const [currentTournament, setCurrentTournament] = useState<any>(null);
  const [currentMatches, setCurrentMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [winnerQueue, setWinnerQueue] = useState<string[]>([]);


  const handleCreate = () => {
    setOnCreate((prev) => !prev);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (players.length < 2) {
      alert("Veuillez ajouter au moins deux joueurs pour creer un tournoi.");
      return;
    }
    if (!tournamentName) {
      alert("Veuillez entrer un nom de tournoi.");
      return;
    }
    setOnCreate(false);
    const newTournament = {
      id: nextTournamentId,
      name: tournamentName,
      players: shuffle(players),
      done: false,
        winner: "",
    };
    setTournaments((prev) => [...prev, newTournament]);
    setNextTournamentId((prev) => prev + 1);
    // Reset form
    setTournamentName("");
    setPlayers([]);
    setPlayer("");
    console.log("Tournament created :", newTournament);
  };

  const handleAddPlayer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!player) {
      alert("Veuillez entrer un nom de joueur.");
      return;
    }
    if (players.includes(player)) {
      alert("Ce joueur a deja ete ajoute.");
      return;
    }
    setPlayers((prev) => [...prev, player]);
    setPlayer("");
  };

  const handleChangeTournamentName = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTournamentName(event.target.value);
  };

  const handleChangePlayer = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlayer(event.target.value);
  };

  const handleDeletePlayer = (event: React.MouseEvent<HTMLButtonElement>) => {
    const playerName = (event.target as HTMLButtonElement).parentElement?.textContent?.slice(
      0,
      -1
    );
    if (playerName) {
      setPlayers((prev) => prev.filter((p) => p !== playerName));
    }
  };

  const handleTournament = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (tournamentInProgress) {
      alert("Un tournoi est deja en cours.");
      return;
    }

    const tournamentName = (event.target as HTMLButtonElement)
      .parentElement?.querySelector(".tournament_name")
      ?.textContent;

    const tournament = tournaments.find((t) => t.name === tournamentName);
    if (!tournament) return;

    const shuffled = shuffle(tournament.players);
    let pool = [...shuffled];

    const nextWinners: string[] = [];
    if (pool.length % 2 === 1) {
      const byePlayer = pool.pop()!;
      nextWinners.push(byePlayer);
    }

    const matches: Match[] = [];
    for (let i = 0; i < pool.length; i += 2) {
      matches.push([pool[i], pool[i + 1]]);
    }

    setCurrentTournament(tournament);
    setCurrentMatches(matches);
    setTournamentInProgress(true);
    setGameInProgress(false);
    setWinnerQueue(nextWinners);
    setCurrentMatchIndex(0);


  };

  const handleStartMatch = () => {
    setGameInProgress(true);
  };

  const finishTournament = (winner: string) => {
    setTournaments((prev) =>
      prev.map((t) =>
        t.id === currentTournament.id ? { ...t, done: true } : t
        ).map((t) =>
            t.id === currentTournament.id ? { ...t, winner: winner } : t
      )
    );
    setTournamentInProgress(false);
    setGameInProgress(false);
    setCurrentTournament(null);
    setCurrentMatches([]);
    setCurrentMatchIndex(0);
    setWinnerQueue([]);
  };

  const handleNextRound = (allWinners: string[]) => {
    if (allWinners.length === 1) {
        finishTournament(allWinners[0]);
        return;
    }

    let pool = [...allWinners];
    const nextCarry: string[] = [];

    if (pool.length % 2 === 1) {
        const bye = pool.pop()!;
        nextCarry.push(bye);
    }

    const newMatches: Match[] = [];
    for (let i = 0; i < pool.length; i += 2) {
        newMatches.push([pool[i], pool[i + 1]]);
    }

    setCurrentMatches(newMatches);
    setCurrentMatchIndex(0);
    setWinnerQueue(nextCarry);

};

  // render
  return (
    <div className="tournament_container">
      <h1 className="tournament_title">Tournois Pong</h1>
      <div className="inline_section">
        <p className="tournament_subtitle">
          Creez un tournoi local avec vos amis
        </p>
        <button
          className="tournament_create_button"
          onClick={handleCreate}
        >
          Creer un tournoi
        </button>
      </div>

      {onCreate && (
        <div className="create_tournament_section">
          <h2 className="create_title">Nouveau tournoi</h2>
          <form className="create_tournament_form" onSubmit={handleSubmit}>
            <p className="create_name">Nom du tournoi</p>
            <input
              type="text"
              className="create_name_input"
              placeholder="Entrez le nom du tournoi"
              value={tournamentName}
              onChange={handleChangeTournamentName}
              required
            />
            <p className="create_players">Ajoutez des joueurs (minimum 2)</p>
          </form>
          <form className="create_add_form" onSubmit={handleAddPlayer}>
            <input
              type="text"
              className="create_players_input"
              placeholder="Nom du joueur"
              value={player}
              onChange={handleChangePlayer}
              required
            />
            <button type="submit" className="create_add_button">
              Ajouter
            </button>
          </form>
          <br />
          <div className="players_list">
            {players.length > 0 && (
              <p className="number">Joueurs ({players.length}):</p>
            )}
            <ul className="player_list_ul">
              {players.map((p, index) => (
                <li key={index} className="player_item">
                  {p}
                  <button
                    className="delete_button"
                    onClick={handleDeletePlayer}
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="submit"
            className="create_submit_button"
            onClick={handleSubmit}
          >
            Creer le tournoi
          </button>
          <button className="create_cancel_button" onClick={handleCreate}>
            Annuler
          </button>
        </div>
      )}

      <ul className="tournament_list">
        {tournaments
          .sort((b, a) => a.id - b.id)
          .map((tournament) => (
            <li key={tournament.id} className="tournament_item">
              <h3 className="tournament_name">{tournament.name}</h3>
              <p
                className={
                  tournament.done
                    ? "tournament_status_good"
                    : "tournament_status_bad"
                }
              >
                {tournament.done ? "Terminé" : "En attente"}
              </p>
              <p className="tournament_players_number">
                {tournament.players.length} joueurs inscrits
              </p>
              <p className="tournament_players">
                {tournament.players.join(", ")}
              </p>
              {!tournament.done && (
                <button
                  className="start_tournament_button"
                  onClick={handleTournament}
                >
                  Démarrer le tournoi
                </button>
              )}
              {tournament.done && tournament.winner !== "" &&
                <p className="tournament_winner">
                    Gagnant : {tournament.winner}
                </p>}
            </li>
          ))}
      </ul>

      {tournamentInProgress &&
        currentTournament &&
        currentMatches.length > 0 && (
          <div className="tournament_in_progress">
            <h2 className="current_tournament_title">
              Tournoi en cours : {currentTournament.name}
            </h2>
            <h3 className="current_match_title">
            {gameInProgress ? "Match en cours :" : "Prochain match :"}{" "}
                <br/>
              {currentMatches[currentMatchIndex][0]} vs{" "}
              {currentMatches[currentMatchIndex][1]}
            </h3>
            {!gameInProgress && (
              <button
                className="start_match_button"
                onClick={handleStartMatch}
              >
                Démarrer le match
              </button>
            )}
            {gameInProgress && (
              <Pong 
                opponnentIA={false}
                isTournament={true}
                onGameEnd={(winner : 1 | 2) => {
                  const current = currentMatches[currentMatchIndex];
                  const winnerName = winner === 1 ? current[0] : current[1];
                  const newWinners = [...winnerQueue, winnerName];
                  setGameInProgress(false);
                  if (currentMatchIndex < currentMatches.length - 1) {
                    setWinnerQueue(newWinners);
                    setCurrentMatchIndex((prev) => prev + 1);
                  } else {
                    handleNextRound(newWinners);
                  }
                  
                }}
              />
            )}
          </div>
        )}
    </div>
  );
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default Tournament;