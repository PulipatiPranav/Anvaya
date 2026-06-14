import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isDeprecated } from "../config/deprecatedGames";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import { logout } from "../utils/logout";
import "./Games.css";
import shapememoryimg     from '../assets/shapememorygame.png';
import mathfunimg         from '../assets/mathfun.png';
import funquizimg         from '../assets/funquiz.png';

const MOOD_TO_EMOTION = {
  happy:   'Happy',
  smile:   'Happy',
  neutral: 'Neutral',
  sad:     'Sad',
  angry:   'Angry',
  surprise:'Surprise',
};

const ALL_GAMES = [
  { key: 'wordpuzzleadventure', label: 'Word Quest',          route: '/wordpuzzleadventure', image: null, emoji: '🗺️', cssClass: 'games-page-word-game'           },
  { key: 'mathgame',            label: 'Math Fun',            route: '/mathgame',            image: mathfunimg,         cssClass: 'games-page-math-game'           },
  { key: 'quiz',                label: 'Fun Quiz',            route: '/quiz',                image: funquizimg,         cssClass: 'games-page-quiz-game'           },
  { key: 'syllabletapgame',     label: 'Fun with Syllables',  route: '/syllabletapgame',     image: null, emoji: '🎵', cssClass: 'games-page-syllable-game'       },
  { key: 'shapememorygame',     label: 'Shape Memory',        route: '/shapememorygame',     image: shapememoryimg,     cssClass: 'games-page-shapememory-game'    },
  { key: 'letterbridge',        label: 'Letter Bridging',     route: '/letterbridge',        image: null, emoji: '🌉', cssClass: 'games-page-letterbridge-game'   },
  { key: 'mirrorword',          label: 'Mirror Words',        route: '/mirrorword',          image: null, emoji: '🪞', cssClass: 'games-page-mirrorword-game'     },
  { key: 'phonemetap',          label: 'Phoneme Tap',         route: '/phonemetap',          image: null, emoji: '👂', cssClass: 'games-page-phonemetap-game'     },
  { key: 'lettersound',         label: 'Letter Sound Match',  route: '/lettersound',         image: null, emoji: '🔤', cssClass: 'games-page-lettersound-game'    },
  { key: 'confusableletter',    label: 'Letter Trainer',      route: '/confusableletter',    image: null, emoji: '🔡', cssClass: 'games-page-confusable-game'     },
  { key: 'ran',                 label: 'Rapid Naming',        route: '/ran',                 image: null, emoji: '⚡', cssClass: 'games-page-ran-game'            },
  { key: 'verbalmemory',        label: 'Sequence Memory',     route: '/verbalmemory',        image: null, emoji: '🧠', cssClass: 'games-page-verbalmemory-game'   },
  { key: 'readingfluency',     label: 'Reading Fluency',     route: '/reading-fluency',     image: null, emoji: '📖', cssClass: 'games-page-verbalmemory-game'   },
  { key: 'sightword',          label: 'Sight Words',         route: '/sight-words',         image: null, emoji: '📝', cssClass: 'games-page-lettersound-game'    },
  { key: 'morphology',         label: 'Word Builder',        route: '/morphology-builder',  image: null, emoji: '🧩', cssClass: 'games-page-confusable-game'     },
];

const ACTIVE_GAMES = ALL_GAMES.filter(g => !isDeprecated(g.key));

export default function Games() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "auto";

    // Apply the background the child chose on the WelcomeScreen
    const mood    = localStorage.getItem("selectedEmotion") || "neutral";
    const emotion = MOOD_TO_EMOTION[mood.toLowerCase()] || "Neutral";
    applyEmotionTheme(emotion);

    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="games-page-container">
      <section className="header-container">
        <h1 className="games-page-title">Choose Your Game</h1>
        <p className="games-page-subtitle">Pick a game and start learning!</p>

        <div className="games-header-nav">
          <button
            className="games-nav-btn games-nav-btn--progress"
            onClick={() => navigate('/my-progress')}
            aria-label="View my progress"
          >
            🌟 My Progress
          </button>
          <button
            className="games-nav-btn games-nav-btn--achievements"
            onClick={() => navigate('/achievements')}
            aria-label="View my achievements"
          >
            🏆 My Achievements
          </button>
          <button
            className="games-nav-btn games-nav-btn--logout"
            onClick={logout}
            aria-label="Log out and return to login"
          >
            🚪 Logout
          </button>
        </div>
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
  );
}
