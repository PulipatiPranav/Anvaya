import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isDeprecated } from "../config/deprecatedGames";
import "./Games.css";
import shapememoryimg    from '../assets/shapememorygame.png';
import mathfunimg        from '../assets/mathfun.png';
import funquizimg        from '../assets/funquiz.png';
import wordquestimg      from '../assets/wordquest.png';
import syllabletapgameimg from '../assets/syllabletapgame.png';
import letterbridgeimg   from '../assets/letterbridge.png';
import mirrorwordgameimg from '../assets/mirrorwordsgame.png';

const ALL_GAMES = [
  { key: 'wordpuzzleadventure', label: 'Word Quest',           route: '/wordpuzzleadventure', image: wordquestimg,        alt: 'Word Quest',              cssClass: 'games-page-word-game'           },
  { key: 'mathgame',            label: 'Math Fun',             route: '/mathgame',            image: mathfunimg,          alt: 'Math Fun',                cssClass: 'games-page-math-game'           },
  { key: 'quiz',                label: 'Fun Quiz',             route: '/quiz',                image: funquizimg,          alt: 'Fun Quiz',                cssClass: 'games-page-quiz-game'           },
  { key: 'syllabletapgame',     label: 'Fun with Syllables',   route: '/syllabletapgame',     image: syllabletapgameimg,  alt: 'Fun with Syllables',      cssClass: 'games-page-syllable-game'       },
  { key: 'shapememorygame',     label: 'Shape Memory Game',    route: '/shapememorygame',     image: shapememoryimg,      alt: 'Shape Memory Game',       cssClass: 'games-page-shapememory-game'    },
  { key: 'letterbridge',        label: 'Letter Bridging Game', route: '/letterbridge',        image: letterbridgeimg,     alt: 'Letter Bridging Game',    cssClass: 'games-page-letterbridge-game'   },
  { key: 'mirrorword',          label: 'Mirror Word Game',     route: '/mirrorword',          image: mirrorwordgameimg,   alt: 'Mirror Word Game',        cssClass: 'games-page-mirrorword-game'     },
  // New clinical games — no PNG asset yet, use emoji tile
  { key: 'phonemetap',          label: 'Phoneme Tap',          route: '/phonemetap',          image: null, emoji: '👂',  alt: 'Phoneme Tap Game',        cssClass: 'games-page-phonemetap-game'        },
  { key: 'lettersound',         label: 'Letter Sound Match',   route: '/lettersound',         image: null, emoji: '🔤',  alt: 'Letter Sound Match',      cssClass: 'games-page-lettersound-game'       },
  { key: 'confusableletter',    label: 'Letter Trainer',       route: '/confusableletter',    image: null, emoji: '🔡',  alt: 'Confusable Letter Trainer', cssClass: 'games-page-confusable-game'       },
  { key: 'ran',                 label: 'Rapid Naming',         route: '/ran',                 image: null, emoji: '⚡',  alt: 'Rapid Automatized Naming', cssClass: 'games-page-ran-game'              },
  { key: 'verbalmemory',        label: 'Sequence Memory',      route: '/verbalmemory',        image: null, emoji: '🧠',  alt: 'Verbal Sequence Memory',   cssClass: 'games-page-verbalmemory-game'     },
];

const ACTIVE_GAMES = ALL_GAMES.filter(g => !isDeprecated(g.key));

function Games() {
  const navigate = useNavigate();
  const [emotion, setEmotion] = useState("neutral");

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "hidden"; };
  }, []);

  useEffect(() => {
    const selected = localStorage.getItem("selectedEmotion") || "neutral";
    setEmotion(selected);
  }, []);

  const backgroundMap = {
    happy:    "url('/gameBackgrounds/happy.jpg')",
    smile:    "url('/gameBackgrounds/happy.jpg')",
    neutral:  "url('/gameBackgrounds/neutral.jpg')",
    sad:      "url('/gameBackgrounds/sad.jpg')",
    angry:    "url('/gameBackgrounds/angry.jpg')",
    surprise: "url('/gameBackgrounds/surprise.jpg')",
  };

  const backgroundStyle = {
    backgroundImage:    backgroundMap[emotion] || backgroundMap["neutral"],
    backgroundSize:     "cover",
    backgroundPosition: "center",
    backgroundRepeat:   "no-repeat",
    minHeight:          "100vh",
    minWidth:           "100vw",
  };

  return (
    <div style={backgroundStyle}>
      <div className="games-page-container">
        <section className="header-container">
          <h1 className="games-page-title">Choose Your Game</h1>
          <p className="games-page-subtitle">Select a game and start your adventure!</p>
        </section>

        <div className="games-page-list" role="list">
          {ACTIVE_GAMES.map(game => (
            <button
              key={game.key}
              role="listitem"
              className={`games-page-card ${game.cssClass}`}
              onClick={() => navigate(game.route)}
              aria-label={`Play ${game.label}`}
            >
              {game.image
                ? <img src={game.image} alt="" className="game-icon" />
                : <span className="game-icon-emoji" aria-hidden="true">{game.emoji}</span>
              }
              <h2>{game.label}</h2>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Games;
