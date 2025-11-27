import mosulImage from '../assets/mosul.png';
import './ComingSoon.css';

export const ComingSoon = () => {
  return (
    <div className="coming-soon-page">
      <div className="snowflakes" aria-hidden="true">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="snowflake"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 3 + 5}s`,
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${Math.random() * 10 + 10}px`,
            }}
          >
            *
          </div>
        ))}
      </div>

      <div className="coming-soon-container">
        <div className="coming-soon-avatar">
          <img src={mosulImage} alt="Mos Craciun" />
        </div>
        <h1 className="coming-soon-title">Suna-l pe Mos Craciun</h1>
        <p className="coming-soon-subtitle">Magia Craciunului, la un click distanta</p>
        <div className="coming-soon-badge">Coming Soon</div>
      </div>
    </div>
  );
};
